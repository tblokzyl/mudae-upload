require('dotenv').config(); // To load environment variables
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const axios = require('axios'); // For making HTTP requests
const FormData = require('form-data'); // For formatting image upload data

// Retrieve environment variables
const IMGUR_ACCESS_TOKEN = process.env.UPLOAD_BOT_IMGUR_ACCESS_TOKEN; // This will be set after OAuth flow
const DISCORD_TOKEN = process.env.UPLOAD_BOT_DISCORD_TOKEN;

// Initialize the bot client with the necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // To interact with guilds (servers)
        GatewayIntentBits.GuildMessages, // To interact with messages
        GatewayIntentBits.MessageContent, // To read message content (necessary for commands)
    ]
});

// Function to create an album on Imgur
async function createAlbum() {
    try {
        const response = await axios.post('https://api.imgur.com/3/album', {}, {
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

// Function to upload an image to Imgur album (existing or new)
async function uploadImageToAlbum(imageUrl, albumId) {
    const form = new FormData();
    form.append('image', imageUrl);  // The URL of the image
    form.append('type', 'url');      // Indicating we are uploading from a URL
    form.append('album', albumId);   // The album ID we created or received

    try {
        const response = await axios.post('https://api.imgur.com/3/upload', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${IMGUR_ACCESS_TOKEN}`,
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading image to album:', error.response ? error.response.data : error.message);
        throw new Error('Error uploading image to album');
    }
}

// Main function to create an album and upload an image
async function createAlbumAndUploadImage(imageUrl, albumCode) {
    try {
        // Use the provided album code or create a new album
        const albumId = albumCode || await createAlbum();
        console.log(`Album ID: ${albumId}`);

        // Wait for the album creation process to be complete (1 second delay here)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 2: Upload the image to the selected or newly created album
        const imgurResponse = await uploadImageToAlbum(imageUrl, albumId);
        console.log(`Image uploaded successfully: ${imgurResponse.data.link}`);

        // Return the image URL
        return imgurResponse.data.link;
    } catch (error) {
        console.error('Error in uploading process:', error.message);
        throw new Error('Error uploading image');
    }
}

// Register the /upload command globally once the bot is logged in
client.on('ready', async () => {
    const command = new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Upload an image to Imgur')
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('The URL of the image on Image Chest')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('album_code')
                .setDescription('The existing Imgur album code to upload the image to (optional)')
                .setRequired(false));

    // Register globally, no need to specify guildId
    await client.application.commands.create(command);
});

// Handle interactions with the slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'upload') {
        const imageUrl = interaction.options.getString('image_url');  // The Image Chest URL
        const albumCode = interaction.options.getString('album_code'); // The album code, if provided

        if (!imageUrl) {
            return interaction.reply('Please provide a valid image URL!');
        }

        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply();

        try {
            // Upload to the existing album or create a new one
            const imageLink = await createAlbumAndUploadImage(imageUrl, albumCode);
            return interaction.editReply(`Here is your uploaded image: ${imageLink}`);
        } catch (error) {
            return interaction.editReply('There was an error uploading the image.');
        }
    }
});

// Log the bot into Discord
client.login(DISCORD_TOKEN);