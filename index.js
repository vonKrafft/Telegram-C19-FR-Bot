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
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
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
                m.callbackButton('🚶 Sport', 'Covid_sport'),
                m.callbackButton('🛒 Courses', 'Covid_achat'),
                m.callbackButton('🚸 École', 'Covid_enfants'),
                m.callbackButton('⛪ Culte', 'Covid_rassemblement'),
                m.callbackButton('📜 Administratif', 'Covid_demarche'),
                m.callbackButton('💼 Travail', 'Covid_travail'),
                m.callbackButton('👨‍⚕ Médecin', 'Covid_sante'),
                m.callbackButton('👪 Famille', 'Covid_famille'),
                m.callbackButton('♿ Handicap', 'Covid_handicap'),
                m.callbackButton('👨‍⚖ Judiciaire', 'Covid_judiciaire'),
                m.callbackButton('🚚 Déménagement', 'Covid_demenagement'),
                m.callbackButton('🚉 Transport', 'Covid_transit')
            ], {columns: 3}))
        );
    } else {
        return ctx.replyWithMarkdown(
            'Je n\'ai pas toutes tes infos, peux-tu me les donner ?' +
            getMissingCovinfo(ctx.session.covinfo[uid])
        );
    }
};

const handleCurfewCommand = (ctx) => {
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
                m.callbackButton('💼 Travail', 'Curfew_travail'),
                m.callbackButton('👨‍⚕ Médecin', 'Curfew_sante'),
                m.callbackButton('👪 Famille', 'Curfew_famille'),
                m.callbackButton('♿ Handicap', 'Curfew_handicap'),
                m.callbackButton('👨‍⚖ Judiciaire', 'Curfew_judiciaire'),
                m.callbackButton('📝 Missions', 'Curfew_missions'),
                m.callbackButton('🚉 Transport', 'Curfew_transit'),
                m.callbackButton('🐈 Animaux', 'Curfew_animaux')
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

    let profile = ctx.session.covinfo[uid];
    const reason = ctx.match[2];
    const context = ctx.match[1];

    if (!(reason in curfewCategory || reason in attestationCategory)) {
        return ctx.reply('Motif de déplacement invalide !');
    }

    if (hasAllCovinfo(profile)) {
        const pdfBytes = await generatePDF(profile, reason, context);

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
                if (context === 'Curfew') {
                    ctx.reply(
                        'Et voici ton attestation ' +
                        `(${curfewCategory[reason].label})`
                    );
                } else {
                    ctx.reply(
                        'Et voici ton attestation ' +
                        `(${attestationCategory[reason].label})`
                    );
                }
                return ctx.replyWithDocument({
                    source: `${pdfDirectory}/${pdfName}`
                });
            });
        });
    } else {
        return ctx.replyWithMarkdown(
            'Je n\'ai pas toutes tes infos, peux-tu me les donner ?' +
            getMissingCovinfo(profile)
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
    sport:         { page: 1, y: 367, label: '🚶 Sport' },
    achat:         { page: 1, y: 244, label: '🛒 Courses' },
    enfants:       { page: 1, y: 161, label: '🚸 École' },
    rassemblement: { page: 2, y: 781, label: '⛪ Culte' },
    demarche:      { page: 2, y: 726, label: '📜 Administratif' },
    travail:       { page: 2, y: 629, label: '💼 Travail' },
    sante:         { page: 2, y: 533, label: '👨‍⚕ Médecin' },
    famille:       { page: 2, y: 477, label: '👪 Famille' },
    handicap:      { page: 2, y: 422, label: '♿ Handicap' },
    judiciaire:    { page: 2, y: 380, label: '👨‍⚖ Judiciaire' },
    demenagement:  { page: 2, y: 311, label: '🚚 Déménagement'},
    transit:       { page: 2, y: 243, label: '🚉 Transport' }
};

const curfewCategory = {
    travail:       { page: 1, y: 579, label: '💼 Travail' },
    sante:         { page: 1, y: 546, label: '👨‍⚕ Médecin' },
    famille:       { page: 1, y: 512, label: '👪 Famille' },
    handicap:      { page: 1, y: 478, label: '♿ Handicap' },
    judiciaire:    { page: 1, y: 458, label: '👨‍⚖ Judiciaire' },
    missions:      { page: 1, y: 412, label: '📝 Missions' },
    transit:       { page: 1, y: 379, label: '🚉 Transport' },
    animaux:       { page: 1, y: 345, label: '🐈 Animaux' }
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

const generatePDF = async (profile, reason, context) => {
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

    let pdfBase = `${__dirname}/data/certificate.19cca14.pdf`;
    if (context === 'Curfew') {
        pdfBase = `${__dirname}/data/certificate.6d316f6.pdf`;
    }
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

    const page1 = pdfDoc.getPages()[0];
    const page2 = pdfDoc.getPages()[1];
    let page = page1;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawText = (page, text, x, y, size = 11) => {
        page.drawText(text, { x, y, size, font });
    }

    if (context === 'Curfew') {
        drawText(page1, `${firstname} ${lastname}`, 144, 705);
        drawText(page1, birthday, 144, 684);
        drawText(page1, placeofbirth, 310, 684);
        drawText(page1, `${address} ${zipcode} ${city}`, 148, 665);

        page = curfewCategory[reason].page === 1 ? page1 : page2;
        drawText(page, 'x', 73, curfewCategory[reason].y || 0, 12);

        drawText(page1, `Fait à ${city}`, 72, 109, 11);
        drawText(page1, `Le ${datesortie}`, 72, 93, 11);
        drawText(page1, `à ${heuresortie}`, 310, 93, 11);
        drawText(page1, '(Date et heure de début de sortie à mentionner obligatoirement)', 72, 77, 11);
    } else {
        drawText(page1, `${firstname} ${lastname}`, 111, 516);
        drawText(page1, birthday, 111, 501);
        drawText(page1, placeofbirth, 228, 501);
        drawText(page1, `${address} ${zipcode} ${city}`, 126, 487);

        page = attestationCategory[reason].page === 1 ? page1 : page2;
        drawText(page, 'x', 60, attestationCategory[reason].y || 0, 12);

        drawText(page2, `Fait à ${city}`, 72, 99, 11);
        drawText(page2, `Le ${datesortie}`, 72, 83, 11);
        drawText(page2, `à ${heuresortie}`, 310, 83, 11);
        drawText(page2, '(Date et heure de début de sortie à mentionner obligatoirement)', 72, 67, 11);
    }

    const qrTitle1 = 'QR-code contenant les informations ';
    const qrTitle2 = 'de votre attestation numérique';

    const generatedQR = await generateQR(data);
    const generatedQRImage = await pdfDoc.embedPng(generatedQR);

    const pageX = pdfDoc.getPages()[(context === 'Curfew') ? 0 : 1];

    pageX.drawText(qrTitle1 + '\n' + qrTitle2, { 
        x: 470,
        y: 182,
        size: 6,
        font,
        lineHeight: 10,
        color: rgb(1, 1, 1)
    });

    pageX.drawImage(generatedQRImage, {
        x: pageX.getWidth() - 107,
        y: 80,
        width: 82,
        height: 82,
    });

    pdfDoc.addPage();
    const pageLast = pdfDoc.getPages()[(context === 'Curfew') ? 1 : 2];

    pageLast.drawText(qrTitle1 + '\n' + qrTitle2, { 
        x: 50,
        y: pageLast.getHeight() - 70,
        size: 11,
        font,
        color: rgb(1, 1, 1)
    });

    pageLast.drawImage(generatedQRImage, {
        x: 50,
        y: pageLast.getHeight() - 390,
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
    { cmd: '/attestation', desc: 'Attestation de déplacement Covid19 6h-19h' },
    { cmd: '/couvrefeu', desc: 'Attestation de déplacement Covid19 19h-6h' }
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
bot.action(/^(Covid|Curfew)_(.+)/, handleAttestationAction);
bot.command('attestation', handleAttestationCommand);
bot.command('couvrefeu', handleCurfewCommand);
bot.command('nom', handleNameCommand);
bot.command('naissance', handleBirthCommand);
bot.command('adresse', handleAddressCommand);

// Start the bot
bot.launch();
