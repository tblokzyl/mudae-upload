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
        .setDescription('Upload images to Imgur using a formatted input string.')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('Input string: $ai Character Name$URL $ URL $ ...')
                .setRequired(true)
        );

    await client.application.commands.create(command);
});

async function checkAlbumExists(albumName) {
    try {
        const response = await axios.get('https://api.imgur.com/3/account/me/albums', {
            headers: { Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}` },
        });
        return response.data.data.find(album => album.title === albumName);
    } catch (error) {
        console.error('Error checking album existence:', error.response?.data || error.message);
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
        console.error('Error uploading image:', error.response?.data || error.message);
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
    if (!interaction.isCommand() || interaction.commandName !== 'upload') return;

    const input = interaction.options.getString('input'); // Fetch the input string

    // Ensure the input starts with `$ai` and is properly formatted
    const regex = /^\$ai\s+([^$]+)\$(.+)$/; // Matches "$ai Character Name$URL $ URL $ ..."
    const match = input.match(regex);

    if (!match) {
        return interaction.reply({
            content: 'Invalid format! Use: `$ai Character Name$URL $ URL $ ...`',
            ephemeral: true,
        });
    }

    const characterName = match[1].trim(); // Extract the character name
    const urlsString = match[2].trim(); // Extract the string with image URLs

    // Split URLs by `$`, filter out empty entries, and trim whitespace
    const imageUrls = urlsString.split('$').map(url => url.trim()).filter(url => url);

    if (!imageUrls.length) {
        return interaction.reply({
            content: 'No valid image URLs found in your command!',
            ephemeral: true,
        });
    }

    try {
        await interaction.reply(`Processing images for **${characterName}**...`);
    
        const albumName = characterName; // Use character name as the album name
        let album = await checkAlbumExists(albumName);
    
        let albumId;
        if (!album) {
            // If album doesn't exist, create a new one
            album = await createAlbum(albumName);
            albumId = album.id;
    
            // Add a test image and delete it to initialize the album
            const testImage = await uploadImageToAlbum(TEST_IMAGE_URL, albumId);
            await deleteImage(testImage.id);
        } else {
            albumId = album.id;
        }
    
        // Upload each image URL to the album
        const uploadedImages = [];
        for (const imageUrl of imageUrls) {
            const uploadedImage = await uploadImageToAlbum(imageUrl, albumId);
            uploadedImages.push(uploadedImage.link);
        }
    
        // Respond with the album link and uploaded images
        await interaction.editReply(
            `Images for **${characterName}** have been uploaded to the album "${albumName}".\n` +
            `Album Link: https://imgur.com/a/${albumId}\n\n` +
            `Uploaded Images:\n${uploadedImages.join('\n')}`
        );
    } catch (error) {
        console.error('Error handling upload command:', error.message);
        await interaction.editReply(
            'An error occurred while processing the command. Please try again later.'
        );
    }
});

client.login(DISCORD_TOKEN);
