/**
 * Copyright (c) 2020 vonKrafft <contact@vonkrafft.fr>
 * 
 * This file is part of Telegram-C19-FR-Bot
 * https://github.com/vonKrafft/Telegram-C19-FR-Bot
 * 
 * This file may be used under the terms of the GNU General Public License
 * version 3.0 as published by the Free Software Foundation and appearing in
 * the file LICENSE included in the packaging of this file. Please review the
 * following information to ensure the GNU General Public License version 3.0
 * requirements will be met: http://www.gnu.org/copyleft/gpl.html.
 * 
 * This file is provided AS IS with NO WARRANTY OF ANY KIND, INCLUDING THE
 * WARRANTY OF DESIGN, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 */

const { Telegraf } = require('telegraf');
const Extra = require('telegraf/extra');
const session = require('telegraf/session');

const QRCode = require('qrcode');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs');

const whiteList = process.env.WHITELIST.split(',').map(parseFloat);

/*****************************************************************************
 * FEATURES
 *****************************************************************************/

const handleAttestationCommand = (ctx) => {
    const uid = ctx.message.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    if (hasAllCovinfo(ctx.session.covinfo[uid])) {
        return ctx.reply(
            'Je peux générer une attestation pour :\n```\n' +
            getTextCovinfo(ctx.session.covinfo[uid]) +
            '\n```\nPourquoi as-tu besoin de sortir ?', 
            Extra.markdown().markup((m) => m.inlineKeyboard([
                m.callbackButton('💼 Travail', 'Covid_travail'),
                m.callbackButton('🛒 Courses', 'Covid_achats'),
                m.callbackButton('👨‍⚕ Médecin', 'Covid_sante'),
                m.callbackButton('👪 Famille', 'Covid_famille'),
                m.callbackButton('♿ Handicap', 'Covid_handicap'),
                m.callbackButton('🚶 Sport', 'Covid_sport_animaux'),
                m.callbackButton('📜 Convocation', 'Covid_convocation'),
                m.callbackButton('📝 Missions', 'Covid_missions'),
                m.callbackButton('🚸 École', 'Covid_enfants')
            ], {columns: 3}))
        );
    } else {
        return ctx.replyWithMarkdown(
            'Je n\'ai pas toutes tes infos, peux-tu me les donner ?' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }
};
           
const handleNameCommand = (ctx) => {
    const uid = ctx.message.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    let matches;
    const regex = /\/nom +([^ ]+) +([^ ]+)/;

    if ((matches = regex.exec(ctx.message.text)) !== null) {
        ctx.session.covinfo[uid].firstname = ucFirst(matches[1]);
        ctx.session.covinfo[uid].lastname = matches[2].toUpperCase();
        return ctx.replyWithMarkdown(
            'J\'ai bien noté ton nom, merci.' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }

    return ctx.replyWithMarkdown(
        'Je n\'ai pas bien compris, peux-tu répéter ?\n' +
        'Pour rappel, la syntaxe est `/nom <Prénom> <NOM>`'
    );
};
           
const handleBirthCommand = (ctx) => {
    const uid = ctx.message.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    let matches;
    const regex = /\/naissance +([0-9]{2}\/[0-9]{2}\/[0-9]{4}) +([^\n]+)/;

    if ((matches = regex.exec(ctx.message.text)) !== null) {
        ctx.session.covinfo[uid].birthday = matches[1];
        ctx.session.covinfo[uid].placeofbirth = ucFirst(matches[2]);
        return ctx.replyWithMarkdown(
            'Date de naissance bien notée, merci.' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }

    return ctx.replyWithMarkdown(
        'Je n\'ai pas bien compris, peux-tu répéter ?\n' +
        'Pour rappel, la syntaxe est `/naissance <JJ/MM/AAAA> <Ville>`'
    );
};
           
const handleAddressCommand = (ctx) => {
    const uid = ctx.message.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    let matches;
    const regex = /\/adresse +([^,]+), +(\d{5}) +([^\n]+)/;

    if ((matches = regex.exec(ctx.message.text)) !== null) {
        ctx.session.covinfo[uid].address = matches[1];
        ctx.session.covinfo[uid].zipcode = matches[2];
        ctx.session.covinfo[uid].city = ucFirst(matches[3]);
        return ctx.replyWithMarkdown(
            'Merci pour ton adresse, c\'est noté.' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }

    return ctx.replyWithMarkdown(
        'Je n\'ai pas bien compris, peux-tu répéter ?\n' +
        'Pour rappel, la syntaxe est `/adresse <Rue>, <CP> <Ville>`'
    );
};

const handleAttestationAction = async (ctx) => {
    const uid = ctx.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    ctx.deleteMessage();

    const reason = ctx.match[1];

    if (hasAllCovinfo(ctx.session.covinfo[uid])) {
        const pdfBytes = await generatePDF(ctx.session.covinfo[uid], reason);

        const now = new Date();
        const cDate = now.toLocaleDateString('fr-CA', {
            timeZone: 'Europe/Paris'
        });
        const cHour = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Europe/Paris'
        }).replace(':', '-');

        const pdfDirectory = `${__dirname}/data/${uid}`;
        const pdfName = `attestation-${cDate}_${cHour}.pdf`;

        fs.mkdir(pdfDirectory, {recursive: true}, (err) => {
            if (err) {
                console.log(err);
                return ctx.reply(
                    'J\'ai rencontré un problème lors de la création de ' +
                    'l\'espace de stockage de tes attestations.'
                );
            }
            fs.writeFile(`${pdfDirectory}/${pdfName}`, pdfBytes, (err) => {
                if (err) {
                    console.log(err);
                    return ctx.reply(
                        'J\'ai rencontré un problème lors de la création de ' +
                        'ton attestation.'
                    );
                }
                ctx.reply(
                    'Et voici ton attestation ' +
                    `(${attestationCategory[reason].label})`
                );
                return ctx.replyWithDocument({
                    source: `${pdfDirectory}/${pdfName}`
                });
            });
        });
    } else {
        return ctx.replyWithMarkdown(
            'Je n\'ai pas toutes tes infos, peux-tu me les donner ?' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }
};

const handleSettingsCommand = (ctx) => {
    const uid = ctx.message.from.id;
    ctx.session.covinfo = ctx.session.covinfo || {};
    ctx.session.covinfo[uid] = ctx.session.covinfo[uid] || {};

    if (isAccessRestricted(uid)) return ctx.reply(getCredit());

    if (hasAllCovinfo(ctx.session.covinfo[uid])) {
        return ctx.replyWithMarkdown(
            'Voici les informations que j\'ai noté :\n```\n' +
            getTextCovinfo(ctx.session.covinfo[uid]) + '\n```'
        );
    } else {
        return ctx.replyWithMarkdown(
            'Je n\'ai pas toutes tes infos, peux-tu me les donner ?' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }
};

/*****************************************************************************
 * UTILS
 *****************************************************************************/

const attestationCategory = {
    travail:       { padding: 578, label: '💼 Travail' },
    achats:        { padding: 533, label: '🛒 Courses' },
    sante:         { padding: 477, label: '👨‍⚕ Médecin' },
    famille:       { padding: 435, label: '👪 Famille' },
    handicap:      { padding: 396, label: '♿ Handicap' },
    sport_animaux: { padding: 358, label: '🚶 Sport' },
    convocation:   { padding: 295, label: '📜 Convocation' },
    missions:      { padding: 255, label: '📝 Missions' },
    enfants:       { padding: 211, label: '🚸 École' }
};

const isAccessRestricted = (uid) => {
    if (!process.env.WHITELIST) return false;
    return !(whiteList.length == 0 || whiteList.includes(uid));
};

const ucFirst = (str) => {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

const checkCovinfo = (profile) => {
    return {
        isName: profile.firstname && profile.lastname,
        isBirth: profile.birthday && profile.placeofbirth,
        isAddress: profile.address && profile.zipcode && profile.city
    };
};

const hasAllCovinfo = (profile) => {
    const { isName, isBirth, isAddress } = checkCovinfo(profile);
    return (isName && isBirth && isAddress);
};

const getMissingCovinfo = (profile, prefix='\n') => {
    const { isName, isBirth, isAddress } = checkCovinfo(profile);

    if (isName && isBirth && isAddress) return '';

    let output = `${prefix}Il me manque `;
    if (!isName) output += 'ton nom' + ((isBirth && isAddress) ? '.' : ', ');
    if (!isBirth) output += 'ta date de naissance' + (isAddress ? '.' : ', ');
    if (!isAddress) output += 'ton domicile.';

    if (!isName) output += '\n`/nom <Prénom> <NOM>`';
    if (!isBirth) output += '\n`/naissance <JJ/MM/AAAA> <Ville>`';
    if (!isAddress) output += '\n`/adresse <Rue>, <CP> <Ville>`';

    return output;
};

const getTextCovinfo = (profile) => {
    return `Mme/M. : ${profile.firstname} ${profile.lastname}\n` +
        `Né(e) le : ${profile.birthday} à : ${profile.placeofbirth}\n` +
        `Demeurant : ${profile.address}, ${profile.zipcode} ${profile.city}`;
};

const generateQR = (text) => {
    return QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
    });
};

const generatePDF = async (profile, reason) => {
    const now = new Date();
    const cDate = now.toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris'
    });
    const cHour = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'Europe/Paris'
    }).replace(':', 'h');

    const { lastname, firstname, birthday, 
        placeofbirth, address, zipcode, city } = profile
    
    const datesortie = now.toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris'
    });
    const heuresortie = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'Europe/Paris'
    });

    const data = [
        `Cree le: ${cDate} a ${cHour}`,
        `Nom: ${lastname}`,
        `Prenom: ${firstname}`,
        `Naissance: ${birthday} a ${placeofbirth}`,
        `Adresse: ${address} ${zipcode} ${city}`,
        `Sortie: ${datesortie} a ${heuresortie}`,
        `Motifs: ${reason}`,
    ].join(';\n ')

    const pdfBase = `${__dirname}/data/certificate.1e3570bc.pdf`;
    const pdfSrcBytes = fs.readFileSync(`${pdfBase}`);

    const pdfDoc = await PDFDocument.load(pdfSrcBytes);

    // set pdf metadata
    pdfDoc.setTitle('COVID-19 - Déclaration de déplacement');
    pdfDoc.setSubject('Attestation de déplacement dérogatoire');
    pdfDoc.setKeywords([ 'covid19', 'covid-19', 'attestation', 'déclaration', 
        'déplacement', 'officielle', 'gouvernement' ]);
    pdfDoc.setProducer('DNUM/SDIT');
    pdfDoc.setCreator('');
    pdfDoc.setAuthor("Ministère de l'intérieur");

    pdfDoc.addPage()
    const page2 = pdfDoc.getPages()[1]
    const page1 = pdfDoc.getPages()[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawText = (text, x, y, size = 11) => {
        page1.drawText(text, { x, y, size, font });
    }

    drawText(`${firstname} ${lastname}`, 119, 696);
    drawText(birthday, 119, 674);
    drawText(placeofbirth, 297, 674);
    drawText(`${address} ${zipcode} ${city}`, 133, 652);

    drawText('x', 78, attestationCategory[reason].padding, 18);

    drawText(city, 105, 177, 11);
    drawText(`${datesortie}`, 91, 153, 11);
    drawText(`${heuresortie}`, 264, 153, 11);

    const generatedQR = await generateQR(data);
    const generatedQRImage = await pdfDoc.embedPng(generatedQR);

    page1.drawImage(generatedQRImage, {
        x: page1.getWidth() - 156,
        y: 100,
        width: 92,
        height: 92,
    });

    page2.drawImage(generatedQRImage, {
        x: 50,
        y: page2.getHeight() - 350,
        width: 300,
        height: 300,
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};

const getCredit = () => {
    const url = 'https://github.com/vonKrafft/Telegram-C19-FR-Bot';
    return `Ce bot est privé et son utilisation est restreinte.\n` +
        `Pour l'utiliser vous aussi, vous pouvez télécharger son code ` +
        `source et l'héberger vous-même (${url}).`;
}

/*****************************************************************************
 * MAIN
 *****************************************************************************/

// Create bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Session and log
bot.use(session());
bot.use(Telegraf.log());

const botFeatures = [
    { cmd: '/nom', desc: '`<Prénom> <NOM>`' },
    { cmd: '/naissance', desc: '`<JJ/MM/AAAA> <Ville>`' },
    { cmd: '/adresse', desc: '`<Rue>, <CP> <Ville>`' },
    { cmd: '/attestation', desc: 'Attestation de déplacement Covid19' }
];

// Welcome text
bot.start((ctx) => ctx.replyWithMarkdown(
    `*COVID-19 Attestation de déplacement dérogatoire*\n` +
    `En application du décret n°2020-1310 du 29 octobre 2020 prescrivant ` +
    `les mesures générales nécessaires pour faire face à l'épidémie de ` +
    `Covid19 dans le cadre de l\'état d\'urgence sanitaire.\n\n` +
    `Pour plus d'information sur les mesures liée à l'épidémie de Covid19 : ` +
    `https://www.gouvernement.fr/info-coronavirus\n` +
    `Le code source de ce service est consultable sur [GitHub]` +
    `(https://github.com/vonKrafft/Telegram-C19-FR-Bot).\n\n` +
    botFeatures.map(c => `*${c.cmd}* ${c.desc}`).join('\n')
));

// Help text
bot.help((ctx) => ctx.replyWithMarkdown(
    botFeatures.map(c => `*${c.cmd}* ${c.desc}`).join('\n')
));

// Features
bot.settings(handleSettingsCommand);
bot.action(/^Covid_(.+)/, handleAttestationAction);
bot.command('attestation', handleAttestationCommand);
bot.command('nom', handleNameCommand);
bot.command('naissance', handleBirthCommand);
bot.command('adresse', handleAddressCommand);

// Start the bot
bot.launch();
