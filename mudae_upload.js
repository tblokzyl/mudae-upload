require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const FormData = require('form-data');

const IMGUR_ACCESS_TOKEN = process.env.UPLOAD_BOT_IMGUR_ACCESS_TOKEN;
const DISCORD_TOKEN = process.env.UPLOAD_BOT_DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

async function createAlbum() {
    try {
        const response = await axios.post('https://api.imgur.com/3/album', {}, {
            headers: {
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            },
        });

        const albumId = response.data.data.id;

        // Set the album to public
        await axios.put(`https://api.imgur.com/3/album/${albumId}`, {
            title: response.data.data.title,
            privacy: 'public',  // Set the album to public
        }, {
            headers: {
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            }
        });

        return albumId;
    } catch (error) {
        console.error('Error creating album:', error.response ? error.response.data : error.message);
        throw new Error('Error creating album');
    }
}

async function findAlbumByName(albumName) {
    try {
        const response = await axios.get('https://api.imgur.com/3/account/me/albums', {
            headers: {
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            }
        });

        const albums = response.data.data;
        const album = albums.find(a => a.title.toLowerCase().includes(albumName.toLowerCase()));

        return album ? album.id : null;
    } catch (error) {
        console.error('Error finding album:', error.response ? error.response.data : error.message);
        throw new Error('Error finding album');
    }
}

async function uploadImageToAlbum(imageUrl, albumName) {
    let albumId = null;

    if (albumName) {
        albumId = await findAlbumByName(albumName);
    }

    if (!albumId) {
        albumId = await createAlbum();
    }

    const form = new FormData();
    form.append('image', imageUrl);
    form.append('type', 'url');
    form.append('album', albumId);

    try {
        const response = await axios.post('https://api.imgur.com/3/upload', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading image:', error.response ? error.response.data : error.message);
        throw new Error('Error uploading image');
    }
}

client.on('ready', async () => {
    const command = new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Upload an image to Imgur')
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('The URL of the image to upload')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('album_name')
                .setDescription('The name of the album to upload to (optional)'));

    await client.application.commands.create(command);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'upload') {
        const imageUrl = interaction.options.getString('image_url');
        const albumName = interaction.options.getString('album_name');

        if (!imageUrl) {
            return interaction.reply('Please provide a valid image URL!');
        }

        try {
            await interaction.deferReply();

            const imgurResponse = await uploadImageToAlbum(imageUrl, albumName);
            return interaction.editReply(`Image uploaded successfully: ${imgurResponse.data.link}`);
        } catch (error) {
            return interaction.editReply('There was an error uploading the image.');
        }
    }
});

client.login(DISCORD_TOKEN);
