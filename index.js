const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, Partials, ButtonBuilder, ActivityType } = require('discord.js');
const db = require('pro.db');
const config = require('./config.json');

function validateConfig(config) {
    if (!config.prefix || !config.roles || !config.bank_id || !config.color || !config.status) {
        throw new Error("❌CHECK CONFIG OR GO TO CODERS HUB ROOM SUPPORT");
    }
    for (const [key, role] of Object.entries(config.roles)) {
        if (!role.name || !role.price) {
            throw new Error(`❌CHECK CONFIG OR GO TO CODERS HUB ROOM SUPPORT`);
        }
    }
}

try {
    validateConfig(config);
} catch (error) {
    console.error(error.message);
    process.exit(1); 
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

client.setMaxListeners(9999);

client.on("ready", () => {
    client.user.setPresence({
        status: 'online',
    });
    client.user.setActivity({
        type: ActivityType.Custom,
        name: config.status,
        state: config.status,
    });
    
    console.log(`
 ██████╗ ██████╗ ██████╗ ███████╗██████╗ ███████╗██╗  ██╗██╗   ██╗██████╗ 
██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║██║   ██║██╔══██╗
██║     ██║   ██║██║  ██║█████╗  ██████╔╝███████╗███████║██║   ██║██████╔╝
██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗╚════██║██╔══██║██║   ██║██╔══██╗
╚██████╗╚██████╔╝██████╔╝███████╗██║  ██║███████║██║  ██║╚██████╔╝██████╔╝
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝`);
    console.log(`${client.user.tag} Is The Hero Today 🌟`);
});

client.on('messageCreate', async message => {
    if (message.content.startsWith(config.prefix + 'buy')) {
        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle(`شراء الرتب في ${message.guild.name}`)
            .setDescription(`**قم بأختيار الرتبة التي تود في شرائها من القائمة اسفله ⬇️ **`)
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

        const options = Object.entries(config.roles).map(([key, role]) => ({
            label: role.name,
            value: key,
            description: `${role.price.toLocaleString()} Credits`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('role-select')
            .setPlaceholder('اختر الرتبة التي تود في شرائها')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel-role')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Danger);

        const row2 = new ActionRowBuilder().addComponents(cancelBtn);

        const msg = await message.reply({ 
            embeds: [embed], 
            components: [row, row2] 
        });
        
        db.set(`role_process_${message.author.id}_${msg.id}`, true);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'role-select') {
        const roleKey = interaction.values[0];
        const role = config.roles[roleKey];
        
        if (!role) {
            return interaction.reply({ content: '**هذه الرتبة غير متوفرة حالياً**', ephemeral: true });
        }

        if (!db.has(`role_process_${interaction.user.id}_${interaction.message.id}`)) {
            return interaction.reply({ content: '**ليس لديك صلاحية تنفيذ هذه العملية**', ephemeral: true });
        }

        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({ content: '**تمتلك هذه الرتبة بالفعل**', ephemeral: true });
        }

        const cancelBtn = new ButtonBuilder()
    .setCustomId('cancel-role')
    .setLabel('إلغاء')
    .setStyle(ButtonStyle.Danger);

const embed = new EmbedBuilder()
    .setColor(config.color)
    .setDescription(`**لشراء رتبة ${role.name} يرجى تحويل ${role.price.toLocaleString()} إلى <@${config.bank_id}>** 
\`\`\`c ${config.bank_id} ${role.price}\`\`\` 
**لديك دقيقتان لإتمام التحويل أسرع!**`)
    .setFooter({ text: 'نظام بيع الرتب' });

const row2 = new ActionRowBuilder().addComponents(cancelBtn);

await interaction.deferUpdate();
await interaction.message.edit({ embeds: [embed], components: [row2] });        
        const collector = interaction.channel.createMessageCollector({
            time: 120000
        });

        collector.on('collect', async msg => {
            if (msg.content.includes('transferred') && msg.author.id === config.probot_id) {
                try {
                    await interaction.member.roles.add(role.id);
                    await interaction.followUp({ 
                        content: `**تم بنجاح إضافة رتبة ${role.name} إلى حسابك** ✅`, 
                        ephemeral: false 
                    });
                    db.delete(`role_process_${interaction.user.id}_${interaction.message.id}`);
                    collector.stop();
                } catch (error) {
                    console.error('CANT GIVE ROLE', error);
                    await interaction.followUp({ 
                        content: '**حدث خطأ! يرجى التواصل مع الإدارة** ❌', 
                        ephemeral: false 
                    });
                }
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ 
                    content: '**انتهى الوقت المحدد دون إتمام التحويل** ⏰', 
                    ephemeral: false 
                });
            }
        });
    }

    if (interaction.isButton() && interaction.customId === 'cancel-role') {
        if (!db.has(`role_process_${interaction.user.id}_${interaction.message.id}`)) {
            return interaction.reply({ content: '**لا يمكنك إلغاء هذه العملية**', ephemeral: true });
        }

        await interaction.deferUpdate();
        await interaction.message.edit({ 
            content: '**تم الإلغاء بنجاح** ❌', 
            embeds: [], 
            components: [] 
        });
        db.delete(`role_process_${interaction.user.id}_${interaction.message.id}`);
    }
});

client.login(config.token);