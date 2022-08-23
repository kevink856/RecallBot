const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, MessageMentions: { UsersPattern } } = require("discord.js");
const sqlite = require("sqlite3").verbose();
const fs = require("fs");
const prefixesPath = "./data/prefixes.json";
const prefixes = require(prefixesPath);
const guildsPath = "./data/guilds.json";
const guilds = require(guildsPath);
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
const db = new sqlite.Database("./data/main.db", sqlite.OPEN_READWRITE, err => {
	if (err) return console.error(err.message);
});

function updateGuildData(g) {
	prefixes[g.id] = process.env.PREFIX;
	guilds[g.id] = "1";

	db.run(`CREATE TABLE IF NOT EXISTS words${g.id} (Words TEXT PRIMARY KEY, TotalCount INTEGER NOT NULL DEFAULT 1)`);
	g.members.fetch()
		.then(members => {
			members.forEach(member => {
				db.run(`CREATE TABLE IF NOT EXISTS words${g.id}${member.id} (Words TEXT PRIMARY KEY, Count INTEGER NOT NULL DEFAULT 1)`);
			});
		})
		.catch(console.error);

	fs.writeFile(prefixesPath, JSON.stringify(prefixes, null, 4), function writeJSON(err) {
		if (err) console.log(err);
	});
	fs.writeFile(guildsPath, JSON.stringify(guilds, null, 4), function writeJSON(err) {
		if (err) console.log(err);
	});
}

// Run once when bot comes online
client.once("ready", c => {
	c.user.setPresence({ activities: [{ name: "your messages", type: ActivityType.Listening }], status: "online" });
	c.guilds.cache.forEach(g => {
		if (!guilds[g.id]) {
			updateGuildData(g);
		}
	});
	console.log("Recall is ready!");
});

// Run everytime bot joins a new server
client.on("guildCreate", g => {
	updateGuildData(g);
});

// Run everytime bot leaves a server
client.on("guildDelete", g => {
	db.run(`DROP TABLE IF EXISTS words${g.id}`);
	g.members.fetch()
		.then(members => {
			members.forEach(member => {
				db.run(`DROP TABLE IF EXISTS words${g.id}${member.id}`);
			});
		})
		.catch(console.error);
	delete prefixes[g.id];
	delete guilds[g.id];
	fs.writeFile(prefixesPath, JSON.stringify(prefixes, null, 4), function writeJSON(err) {
		if (err) console.log(err);
	});
	fs.writeFile(guildsPath, JSON.stringify(guilds, null, 4), function writeJSON(err) {
		if (err) console.log(err);
	});
});

// Run everytime a message is sent
client.on("messageCreate", m => {
	const prefix = prefixes[m.guild.id];
	const helpEmbed = new EmbedBuilder()
		.setTitle("Recall Help")
		.setDescription(`Recall commands start with **${prefix}**`)
		.setColor(0x3a89ff)
		.addFields({ name: "Commands", value: "[**Command List**](https://websiteindevelopment.com)" });

	if (m.author.bot) { return; }
	if (m.content.substring(0, prefix.length) == prefix) {
		const args = m.content.substring(prefix.length).split(" ");
		const cmd = args[0];
		switch (cmd) {
		case "help":
			m.channel.send({ embeds: [helpEmbed] });
			break;
		case "history":
			if (args.length == 1) {
				const guildHistoryEmbed = new EmbedBuilder()
					.setTitle("Server Message History")
					.setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL() })
					.setColor(0x3a89ff)
					.setThumbnail(m.guild.iconURL());
				db.all(`SELECT Words words, TotalCount totalCount FROM words${m.guild.id} ORDER BY TotalCount DESC LIMIT 15`, (err, rows) => {
					if (err) console.log(err);
					rows
						? rows.forEach(row => {
							let tempWord = row.words;
							if (row.words.length > 20) {
								tempWord = row.words.substring(0, 20) + "..";
							}
							guildHistoryEmbed.addFields({ name: `**${tempWord}**`, value: `${row.totalCount} times`, inline: true });
						})
						: guildHistoryEmbed.setDescription("<:recall:1009990978456801380> This server has no chat activity!");
					m.channel.send({ embeds: [guildHistoryEmbed] });
				});
			}
			else if (args.length == 2) {
				const mention = args[1].matchAll(new RegExp(UsersPattern, "g")).next().value;
				if (!mention || !m.guild.members.cache.get(mention[1])) {
					return m.channel.send({ embeds: [helpEmbed] });
				}
				const mentionedUser = client.users.cache.get(mention[1]);
				const userHistoryEmbed = new EmbedBuilder()
					.setTitle("User Message History")
					.setAuthor({ name: mentionedUser.username, iconURL: mentionedUser.displayAvatarURL() })
					.setColor(0x3a89ff)
					.setThumbnail(mentionedUser.displayAvatarURL());
				db.all(`SELECT Words words, Count count FROM words${m.guild.id}${mentionedUser.id} ORDER BY Count DESC LIMIT 15`, (err, rows) => {
					if (err) console.log(err);
					rows
						? rows.forEach(row => {
							let tempWord = row.words;
							if (row.words.length > 20) {
								tempWord = row.words.substring(0, 20) + "..";
							}
							userHistoryEmbed.addFields({ name: `**${tempWord}**`, value: `${row.count} times`, inline: true });
						})
						: userHistoryEmbed.setDescription("<:recall:1009990978456801380> This user has no chat activity!");
					m.channel.send({ embeds: [userHistoryEmbed] });
				});
			}
			else if (args.length == 3) {
				const mention = args[1].matchAll(new RegExp(UsersPattern, "g")).next().value;
				if (!mention || !m.guild.members.cache.get(mention[1])) {
					return m.channel.send({ embeds: [helpEmbed] });
				}
				const mentionedUser = client.users.cache.get(mention[1]);
				const userHistoryEmbed = new EmbedBuilder()
					.setTitle("User Message History")
					.setAuthor({ name: mentionedUser.username, iconURL: mentionedUser.displayAvatarURL() })
					.setColor(0x3a89ff)
					.setThumbnail(mentionedUser.displayAvatarURL());
				db.get(`SELECT Words words, Count count FROM words${m.guild.id}${mentionedUser.id} WHERE Words = ?`, [args[2]], (err, row) => {
					if (err) console.log(err);
					row
						? userHistoryEmbed.setDescription(`**${mentionedUser.username}** has said **${row.words}** ${row.count} times`)
						: userHistoryEmbed.setDescription("<:recall:1009990978456801380> This user has never said this word!");
					m.channel.send({ embeds: [userHistoryEmbed] });
				});
			}
			else {
				m.channel.send({ embeds: [helpEmbed] });
			}
			break;
		case "prefix":
			if (args.length == 1) {
				m.channel.send({ embeds: [new EmbedBuilder()
					.setDescription(`<:recall:1009990978456801380> Recall commands start with **${prefix}**`)
					.setColor(0x3a89ff)] });
			}
			else {
				const newPrefix = m.content.substring(prefix.length + 7).trim();
				prefixes[m.guild.id] = newPrefix;
				fs.writeFile(prefixesPath, JSON.stringify(prefixes, null, 4), function writeJSON(err) {
					if (err) console.log(err);
				});
				m.channel.send({ embeds: [new EmbedBuilder()
					.setDescription(`<:recall:1009990978456801380> The prefix has been changed to **${newPrefix}**`)
					.setColor(0x3a89ff)] });
			}
			break;
		default:
			m.channel.send({ embeds: [helpEmbed] });
			break;
		}
	}
	else {
		db.run(`CREATE TABLE IF NOT EXISTS words${m.guild.id}${m.author.id} (Words TEXT PRIMARY KEY, Count INTEGER NOT NULL DEFAULT 1)`);
		const args = m.content.split(" ");
		args.forEach(tempArg => {
			let arg = tempArg;
			if (arg.startsWith("http://") || arg.startsWith("https://") || arg.length < 1) {
				return;
			}
			const mention = arg.matchAll(new RegExp(UsersPattern, "g")).next().value;
			if (mention && m.guild.members.cache.get(mention[1])) {
				arg = "@" + client.users.cache.get(mention[1]).username;
			}
			db.run(`INSERT OR IGNORE INTO words${m.guild.id}${m.author.id} (Words) VALUES (?)`, arg);
			db.run(`UPDATE words${m.guild.id}${m.author.id} SET Count = Count + 1 WHERE Words = ?`, arg);

			db.run(`INSERT OR IGNORE INTO words${m.guild.id} (Words) VALUES (?)`, arg);
			db.run(`UPDATE words${m.guild.id} SET TotalCount = TotalCount + 1 WHERE Words = ?`, arg);
		});
	}
});

client.login(process.env.TOKEN);