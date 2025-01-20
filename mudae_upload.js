require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const IMGUR_ACCESS_TOKEN = process.env.UPLOAD_BOT_IMGUR_ACCESS_TOKEN;
const DISCORD_TOKEN = process.env.UPLOAD_BOT_DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Constants
const TEST_IMAGE_URL = 'https://i.imgur.com/ra0cBvz.jpg'; // Test image URL

client.on('ready', async () => {
    console.log('Bot is ready!');

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

async function checkAlbumExists(albumName) {
    try {
        const response = await axios.get('https://api.imgur.com/3/account/me/albums', {
            headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` },
        });
        return response.data.data.find(album => album.title === albumName);
    } catch (error) {
        console.error('Error checking album existence:', error.message);
        throw error;
    }
}

async function createAlbum(albumName) {
    try {
        const response = await axios.post(
            'https://api.imgur.com/3/album',
            { title: albumName },
            { headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` } }
        );
        return response.data.data;
    } catch (error) {
        console.error('Error creating album:', error.message);
        throw error;
    }
}

async function uploadImageToAlbum(imageUrl, albumId) {
    try {
        const response = await axios.post(
            'https://api.imgur.com/3/image',
            { image: imageUrl, type: 'URL', album: albumId },
            { headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` } }
        );
        return response.data.data;
    } catch (error) {
        console.error('Error uploading image:', error.message);
        throw error;
    }
}

async function deleteImage(imageId) {
    try {
        await axios.delete(`https://api.imgur.com/3/image/${imageId}`, {
            headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` },
        });
        console.log(`Image ${imageId} deleted successfully`);
    } catch (error) {
        console.error('Error deleting image:', error.message);
        throw error;
    }
}

async function getAlbumDetails(albumId, retries = 3) {
    try {
        for (let i = 0; i < retries; i++) {
            const response = await axios.get(`https://api.imgur.com/3/album/${albumId}`, {
                headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` },
            });

            if (response.data.data.images_count > 0) return response.data.data;

            console.log('Album not updated yet. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Delay before retrying
        }
        throw new Error('Album details did not update after retries');
    } catch (error) {
        console.error('Error fetching album details:', error.message);
        throw error;
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'upload') {
        const imageUrl = interaction.options.getString('image_url');
        const albumName = interaction.options.getString('album_name') || 'New Album';

        if (!imageUrl) return interaction.reply('Please provide a valid image URL!');

        try {
            await interaction.deferReply();

            const album = await checkAlbumExists(albumName);

            let albumId;
            if (!album) {
                await interaction.editReply(`No album found with the name "${albumName}". Creating a new one...`);
                const createdAlbum = await createAlbum(albumName);
                albumId = createdAlbum.id;

                console.log('Uploading test image...');
                const testImage = await uploadImageToAlbum(TEST_IMAGE_URL, albumId);
                await deleteImage(testImage.id);
            } else {
                albumId = album.id;
                await interaction.editReply(`Found an album with the name "${albumName}". Uploading your image...`);
            }

            const uploadedImage = await uploadImageToAlbum(imageUrl, albumId);
            await getAlbumDetails(albumId);

            await interaction.editReply(`Image uploaded successfully to the album "${albumName}"! Image URL: ${uploadedImage.link}`);
        } catch (error) {
            console.error('Error handling /upload command:', error.message);
            await interaction.editReply('An error occurred while uploading the image. Please try again later.');
        }
    }
});

client.login(DISCORD_TOKEN);