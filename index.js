require('dotenv').config()
import { $, randomUUIDv7 } from "bun";
const fs = require('node:fs');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const MP3Tag = require('mp3tag.js')

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let sc_data = JSON.parse(fs.readFileSync("./data.json"));
let user_data = {};
fs.watch("data.json", () => {
   console.log("new data!");
   sc_data = JSON.parse(fs.readFileSync("./data.json"));
   console.log(sc_data);
});

async function checkData() {
    for(const element of sc_data.sc_ids) {
        try {
            console.log("starting search");
            console.log(`https://api-v2.soundcloud.com/users/${element}/tracks?representation=&client_id=${sc_data.sc_client_id}&limit=1&offset=0&linked_partitioning=1`);
            let data = await(await fetch(`https://api-v2.soundcloud.com/users/${element}/tracks?representation=&client_id=${sc_data.sc_client_id}&limit=1&offset=0&linked_partitioning=1`)).json();
            console.log("finished fetch");
            if(!user_data[element]) {
                console.log("no data for user, setting data rq");
                user_data[element] = {
                    "song_url": ""
                }
            }
            if(!data["collection"][0]) {
                return;
            }
            if(user_data[element]["song_url"] != data["collection"][0]["permalink_url"]) {
                if(data["collection"][0]["media"]["transcodings"][0]["url"].includes("encrypted")) {
                    sc_data.channels.forEach(element => {
                        const channel = client.channels.cache.get(element);
                        let embed = new EmbedBuilder()
                            .setTitle(`${data["collection"][0]["publisher_metadata"]["artist"]} dropped`)
                            .setURL(data["collection"][0]["permalink_url"])
                            .setThumbnail(data["collection"][0]["artwork_url"].replace("large", "t1080x1080").replace(".png", ".jpg"))
                            .setDescription(`**NOT SOUNDCLOUD EXCLUSIVE**, music file is encrypted\n${data["collection"][0]["title"]} by ${data["collection"][0]["publisher_metadata"]["artist"]}\n${data["collection"][0]["permalink_url"]}\n<t:${Math.floor(new Date(data["collection"][0]["release_date"]).getTime() / 1000)}:R>`)
                        channel.send({ content: "@everyone", embeds: [ embed ] });
                    });
                    user_data[element]["song_url"] = data["collection"][0]["permalink_url"];
                } else {
                    console.log("new song");
                    let uuid = randomUUIDv7();
                    let streamingURL = await(await fetch(data["collection"][0]["media"]["transcodings"][0]["url"] + "?client_id=" + sc_data.sc_client_id)).json();
                    await $`ffmpeg -i "${streamingURL["url"]}" tmp/${uuid}.mp3`;
                    console.log("ffmpeg finished downloading");
                    let cover = await(await fetch(data["collection"][0]["artwork_url"].replace("large", "t1080x1080").replace(".png", ".jpg"))).arrayBuffer();
                    console.log("fetched album cover");
                    let music = fs.readFileSync(`tmp/${uuid}.mp3`);
                    const mp3tag = new MP3Tag(music, true);
                    mp3tag.read()
                    console.log("begin writing tags");
                    mp3tag.tags.title = data["collection"][0]["title"];
                    mp3tag.tags.artist = data["collection"][0]["publisher_metadata"]["artist"];
        
                    mp3tag.tags.v2.APIC = [
                        {
                          format: 'image/jpeg',
                          type: 3,
                          description: 'Album image',
                          data: cover
                        }
                    ];
                    mp3tag.save();
                    fs.writeFileSync(`tmp/${data["collection"][0]["publisher_metadata"]["artist"]} - ${data["collection"][0]["title"]}.mp3`, mp3tag.buffer)
                    console.log("saved tags");
                    sc_data.channels.forEach(element => {
                        const channel = client.channels.cache.get(element);
                        let embed = new EmbedBuilder()
                            .setTitle(`${data["collection"][0]["publisher_metadata"]["artist"]} dropped`)
                            .setURL(data["collection"][0]["permalink_url"])
                            .setThumbnail(data["collection"][0]["artwork_url"].replace("large", "t1080x1080").replace(".png", ".jpg"))
                            .setDescription(`**SOUNDCLOUD EXCLUSIVE**, music file is not encrypted\n${data["collection"][0]["title"]} by ${data["collection"][0]["publisher_metadata"]["artist"]}\n${data["collection"][0]["permalink_url"]}\n<t:${Math.floor(new Date(data["collection"][0]["created_at"]).getTime() / 1000)}:R>`)
                        channel.send({ content: "@everyone", embeds: [ embed ], files: [`tmp/${data["collection"][0]["publisher_metadata"]["artist"]} - ${data["collection"][0]["title"]}.mp3`]});
                    });
                    user_data[element]["song_url"] = data["collection"][0]["permalink_url"];
                }
            }
        } catch (err) {
            console.log(err);
        }
    }
}

client.login(process.env.TOKEN);
client.once(Events.ClientReady, async readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    setInterval(await checkData, 90000);
    // checkData();
});
