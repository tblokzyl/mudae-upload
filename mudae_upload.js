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

async function createAlbum(albumName = null) {
    try {
        const data = albumName ? { title: albumName } : {};
        const response = await axios.post('https://api.imgur.com/3/album', data, {
            headers: {
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`
            }
        });
        return response.data.data.id;
    } catch (error) {
        console.error('Error creating album:', error.response ? error.response.data : error.message);
        throw new Error('Error creating album');
    }
}

async function uploadImageToAlbum(imageUrl, albumId) {
    const form = new FormData();
    form.append('image', imageUrl);
    form.append('type', 'url');
    if (albumId) {
        form.append('album', albumId);
    }

    try {
        const response = await axios.post('https://api.imgur.com/3/upload', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            }
        });

        console.log('Imgur upload response:', response.data);

        return response.data;
    } catch (error) {
        console.error('Error uploading image to album:', error.response ? error.response.data : error.message);
        throw new Error('Error uploading image to album');
    }
}

async function createAlbumAndUploadImage(imageUrl, albumCode = null, albumName = null) {
    try {
        const albumId = albumCode || await createAlbum(albumName);
        const imgurResponse = await uploadImageToAlbum(imageUrl, albumId);
        return imgurResponse.data.link;
    } catch (error) {
        console.error('Error in uploading process:', error.message);
    }
}

client.on('ready', async () => {
    const command = new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Upload an image from Image Chest to Imgur')
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('The URL of the image on Image Chest')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('album_code')
                .setDescription('The existing album code (optional)'))
        .addStringOption(option =>
            option.setName('album_name')
                .setDescription('The name of the album to create (optional)'));

    await client.application.commands.create(command);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'upload') {
        const imageUrl = interaction.options.getString('image_url');
        const albumCode = interaction.options.getString('album_code');
        const albumName = interaction.options.getString('album_name'); 

        if (!imageUrl) {
            return interaction.reply('Please provide a valid image URL!');
        }

        try {
            await interaction.deferReply();

            const imageLink = await createAlbumAndUploadImage(imageUrl, albumCode, albumName);
            await interaction.editReply(`Image uploaded: ${imageLink}`);
        } catch (error) {
            await interaction.editReply('There was an error uploading the image.');
        }
    }
});

client.login(DISCORD_TOKEN);
