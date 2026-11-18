/*

    Motion Graphic Templates
    GLUS Template Project
    Methods
    1.0 - jonathan.frank@dw.com

*/

jsx = {

    ////////////////////////////// S E T T I N G S ////////////////////////////

    // set this to actual JSON
    json: thisLayer.footage("GLUS 1_0.json").sourceData,

    // these words will be stripped from layer and comp names when looked up in JSON
    jsonNameStrip: [
        "^[A-Z]{4}\\s", // remove 4 uppercase letters at the start of the name, e. g. 'AAAA'
        "RTL",
        "LTR"
    ],

    ///////////////////////////////////////////////////////////////////////////

    /**
     *  Returns a JSON-compliant name
     */
    jsonName: function (name) {
        // check for name integrity 
        if (/[.*+?^${}()|[\]\\]/.test(name)) throw new Error("Name contains illegal characters: " + name);
        const PATTERN = new RegExp("(" + jsx.jsonNameStrip.join("|") + ")\\b", "g");
        return name
            .replace(/^.*#/, "") // keep only text after #
            .replace(PATTERN, "") // strip format abbreviation and certain words
            .trim()
            .replace(/\s/g, "_") // replace spaces with underlines
            .toLowerCase();
    },

    /**
     *   Returns a .style object
     *   @param text {string} - text to output
     *   @param [element] {string} - sub-style, e. g. "1_line" for multiple lower third styles
     *   @param [alphabet] {string} - alphabet override, e. g. "latin" for arabic social media inserts
     */
    setStyle: function (text, element, alphabet, fontSizeReduction) {
        if (text === null) throw new Error("setStyle(): No output text given.");

        try {
            const STYLE = jsx.getStyle(element, alphabet);

            return thisLayer.text.sourceText.style
                .setFont(STYLE.fontFamily)
                .setFontSize(STYLE.fontSize)
                .setAutoLeading(STYLE.leading === undefined)
                .setLeading(STYLE.leading || 0)
                .setTracking(STYLE.tracking || 0) // find more methods at https://ae-expressions.docsforadobe.dev/text/style/#methods
                .setText(text);
        } catch (error) {
            throw new Error("setStyle: " + error);
        }
    },

    /**
     *  Returns style accordings to language / alphabet
     *  @param [element] {string} - name of the sub-element as found in the styles object
     *  @param [alphabet] {string} - instead of retrieving the alphabet in use, style for alphabet given is returned
     */
    getStyle: function (element, alphabet) {
        const STYLES = jsx.json.styles;
        const ALPHABET = alphabet || jsx.getAlphabet();
        const COMP = jsx.jsonName(thisComp.name);
        const LAYER = jsx.jsonName(thisLayer.name);
        // note: optional chaining (?.) and nullish coalescing (??) can be used in expressions
        // but NOT for ae properties:
        // thisComp?.layer("in question") // will still throw an error
        try {
            if (LAYER === "warning_message") return STYLES?.[LAYER];
            else return STYLES?.[ALPHABET]?.[COMP]?.[element]?.[LAYER] ?? STYLES?.[ALPHABET]?.[COMP]?.[LAYER];
        } catch (error) {
            throw new Error("getStyle(): Couldn't retrieve style.");
        }
    },

    getCreditsDefaults: function (defaults) {
        return jsx.json.languages[jsx.getLanguage()].creditsDefaults[defaults];
    },

    getTransitionReportDefaults: function (defaults) {
        return jsx.json.languages[jsx.getLanguage()].transitionReportDefaults[defaults];
    },

    getLastReportDefaults: function (defaults) {
        return jsx.json.languages[jsx.getLanguage()].lastReportDefaults[defaults];
    },

    /**
     *  Returns name of language chosen in the Essential Graphics Menu
     */
    getLanguage: function () {
        const LANGUAGE = thisComp.layer("UI Input").effect("Language")(1).value;
        let subset = null;
        try { // get language from JSON subsets array
            subset = thisComp.layer("Settings").effect("Language Subset")(1).value;
            return jsx.json?.language_subsets?.[subset - 1]?.[LANGUAGE - 1]
        } catch (error) {
            // get language directly from JSON languages object
            return Object.keys(jsx.json.languages)[LANGUAGE - 1];
        }
    },

    /**
     *  Tries to return name of alphabet chosen in the Essential Graphics Menu (effect("Alphabet"))
     *  otherwise returns name of alphabet used by language chosen in the the Essential Graphics Menu (effect("Alphabet"))
     */
    getAlphabet: function () {
        try {
            const ALPHABET = thisComp.layer("UI Input").effect("Alphabet")(1).value;
            let subset = null;
            try { // get alphabet from JSON subsets array
                subset = thisComp.layer("Settings").effect("Alphabet Subset")(1).value;
                return jsx.json?.alphabet_subsets?.[subset - 1]?.[ALPHABET - 1]
            } catch (error) {
                // get language directly from JSON languages object
                return Object.keys(jsx.json.languages)[ALPHABET - 1];
            }
        } catch (error) { }
        return jsx.json.languages[jsx.getLanguage()].alphabet;
    },

    /**
     * Returns text direction used by language chosen in the Essential Graphics Menu
     */
    getTextDirection: function () {
        return jsx.json.alphabets[jsx.getAlphabet()].textDirection;
    },

    uiValue: function (name) {
        return thisComp.layer("UI Input").effect(name)(1).value;
    },

    isRtl: function () {
        return jsx.getAlphabet() === "arabic";
    },

    isActiveDirectionalLayer: function (ltrName, rtlName) {
        return thisLayer.name === (jsx.isRtl() ? rtlName : ltrName);
    },

    inputLines: function (layerName, uppercase) {
        let text = thisComp.layer(layerName).text.sourceText.replace(/\s+$/g, "");
        if (uppercase) text = text.toUpperCase();
        return text.split("\r").filter(function (line) { return line !== ""; });
    },

    warningStyle: function (messages) {
        const text = messages.length ? "Sorry!\r\r" + messages.join("\r") : "";
        return jsx.setStyle(text);
    },

    centeredAnchorPoint: function () {
        const rect = thisLayer.sourceRectAtTime();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    },

    directionalTextPosition: function (horizontalMargin, topMargin, bottomMargin) {
        const layer = thisComp.layer(jsx.isRtl() ? "Text RTL" : "Text LTR");
        const rect = layer.sourceRectAtTime();
        const x = jsx.uiValue("X Position");
        const y = jsx.uiValue("Y Position");
        return [
            thisLayer.linear(x, -100, 100, horizontalMargin + rect.width / 2, 1920 - horizontalMargin - rect.width / 2),
            thisLayer.linear(y, -100, 100, topMargin + rect.height / 2, 1080 - bottomMargin - rect.height / 2)
        ];
    },

    directionalTextOpacity: function (introStart, introEnd, introLimit) {
        if (!jsx.isActiveDirectionalLayer("Text LTR", "Text RTL")) return 0;
        const animation = jsx.uiValue("Animation");
        if (thisLayer.time <= introLimit && animation < 3) {
            return thisLayer.ease(thisLayer.time, introStart, introEnd, 0, 100);
        }
        if (animation === 1 || animation === 3) {
            return thisLayer.ease(thisLayer.time, thisComp.duration - 0.4, thisComp.duration, 100, 0);
        }
        return 100;
    },


    // Localizer Template
    localizerWarning: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        let message = [];
        const TEXT_POSITION_LTR = thisComp.layer("Text LTR").transform.position[0];
        const TEXT_POSITION_RTL = thisComp.layer("Text RTL").transform.position[0];

        if (TEXT_POSITION_LTR < 160 + 60 && jsx.getAlphabet() != "arabic" || TEXT_POSITION_RTL > 1920 - 160 - 60) {
            message.push("Text is overflowing. Please shorten the input.");
        }
        if (INPUT_TEXT_LENGTH > 1) {
            message.push("Localizer Text can only contain one line.");
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);
    },
    localizerText: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT = thisComp.layer("Input Text").text.sourceText.trim();
        if (jsx.isActiveDirectionalLayer("Text LTR", "Text RTL")) return jsx.setStyle(INPUT_TEXT);
    },
    localizerTextPosition: function () {
        thisLayer.posterizeTime(0);
        if (thisLayer.name == "Text LTR" && jsx.getAlphabet() == "cyrillic") {
            return [thisComp.layer("Banderole").content("Rectangle Path 1").position[0] + 40, 942];
        } else if (thisLayer.name == "Text LTR" && jsx.getAlphabet() == "latin") {
            return [thisComp.layer("Banderole").content("Rectangle Path 1").position[0] + 60, 942];
        } else if (thisLayer.name == "Text RTL") {
            return [thisComp.layer("Banderole").content("Rectangle Path 1").position[0] - 60, 933];
        }
    },
    localizerTextOpacity: function () {
        if (!jsx.isActiveDirectionalLayer("Text LTR", "Text RTL")) return 0;
        const animation = jsx.uiValue("Animation");
        if (thisLayer.time <= 1.04 && animation < 3) return thisLayer.ease(thisLayer.time, 0.28, 0.48, 0, 100);
        if (animation === 1 || animation === 3) return thisLayer.ease(thisLayer.time, 5.56, 5.96, 100, 0);
        return 100;
    },
    localizerBanderoleSize: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        let size = [0, 0];
        let textWidth = 0;
        let additionalWidth = 120;
        if (jsx.getAlphabet() == "cyrillic") {
            additionalWidth = 80;
        }
        let height = 0;
        // let minWidth = 877 // if it should look like latin preview;
        // let minWidth = 892 // if it should look like arabic preview;
        let minWidth = 525;
        if (jsx.getAlphabet() == "arabic") {
            height = 103;
            textWidth = thisComp.layer("Text RTL").sourceRectAtTime().width;
        } else if (jsx.getAlphabet() == "latin" || jsx.getAlphabet() == "cyrillic") {
            height = 94;
            textWidth = thisComp.layer("Text LTR").sourceRectAtTime().width;
        }
        if (ANIMATE < 3) {
            size = thisLayer.linear(thisLayer.time, 0, 0.28, [0, height], [Math.max(minWidth, additionalWidth + textWidth), height]);
        } else {
            size = [Math.max(minWidth, additionalWidth + textWidth), height];
        }
        return size;
    },
    localizerBanderolePosition: function () {
        rtlTxtWidth = thisComp.layer("Text RTL").sourceRectAtTime().width;
        if (jsx.getAlphabet() != "arabic") {
            return [1760 - thisLayer.sourceRectAtTime(2).width, 969 - thisLayer.content("Rectangle Path 1").size[1] / 2];
        } else if (jsx.getAlphabet() == "arabic") {
            return [160 + thisLayer.sourceRectAtTime(2).width, 969 - thisLayer.content("Rectangle Path 1").size[1] / 2];
        }
    },
    localizerBanderoleOpacity: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        let fade = 0;
        if (ANIMATE == 1 || ANIMATE == 3) {
            fade = thisLayer.ease(thisLayer.time, 5.56, 5.96, 86, 0);
        } else {
            fade = 86;
        }
        return fade;
    },
    localizerBanderoleAnchorPoint: function () {
        if (jsx.getAlphabet() == "latin" || jsx.getAlphabet() == "cyrillic") {
            return [-thisLayer.content("Rectangle Path 1").size[0] / 2, 0];
        } else if (jsx.getAlphabet() == "arabic") {
            return [thisLayer.content("Rectangle Path 1").size[0] / 2, 0];
        }
    },


    //----------------------------- Credits Template
    creditsWarning: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_TEAM_LENGTH = thisComp.layer("Input Text Team").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_TEXT_PRODUCER_LENGTH = thisComp.layer("Input Text Producer").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const TEXT_TEAM_WIDTH_LTR = thisComp.layer("Text Team LTR").sourceRectAtTime().width;
        const TEXT_TEAM_WIDTH_RTL = thisComp.layer("Text Team RTL").sourceRectAtTime().width;
        const TEXT_PRODUCER_WIDTH_LTR = thisComp.layer("Text Producer LTR").sourceRectAtTime().width;
        const TEXT_PRODUCER_WIDTH_RTL = thisComp.layer("Text Producer RTL").sourceRectAtTime().width;
        const MAX_TEXT_WIDTH = 620;
        let message = [];
        if (INPUT_TEXT_TEAM_LENGTH > 6) {
            message.push("Team can only contain six lines.");
        }
        if (jsx.getLanguage() == "arabic" && INPUT_TEXT_PRODUCER_LENGTH > 2) {
            message.push("Producer can only contain two lines.");
        } else if (jsx.getLanguage() != "arabic" && INPUT_TEXT_PRODUCER_LENGTH > 1) {
            message.push("Producer can only contain one line.");
        }
        if (Math.max(TEXT_TEAM_WIDTH_LTR, TEXT_TEAM_WIDTH_RTL, TEXT_PRODUCER_WIDTH_LTR, TEXT_PRODUCER_WIDTH_RTL) > MAX_TEXT_WIDTH) {
            message.push("Text is overflowing. Please shorten the input.");
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);
    },
    creditsText: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_TEAM_LTR = thisComp.layer("Input Text Team").text.sourceText.replace(/\s+$/g, '').toUpperCase().split("\r").filter(x => x !== '');
        const INPUT_TEXT_TEAM_RTL = thisComp.layer("Input Text Team").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const INPUT_TEXT_PRODUCER_LTR = thisComp.layer("Input Text Producer").text.sourceText.replace(/\s+$/g, '').toUpperCase().split("\r").filter(x => x !== '');
        const INPUT_TEXT_PRODUCER_RTL = thisComp.layer("Input Text Producer").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        if (thisLayer.name == "Text Team Headline LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text Team Headline LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Team"));
        } else if (thisLayer.name == "Text Team Headline RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Team"));
        } else if (thisLayer.name == "Text Team LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text Team LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(INPUT_TEXT_TEAM_LTR.join("\r"));
        } else if (thisLayer.name == "Text Team RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(INPUT_TEXT_TEAM_RTL.join("\r"));
        } else if (thisLayer.name == "Text Producer Headline LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text Producer Headline LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Executive Producer"));
        } else if (thisLayer.name == "Text Producer Headline RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Executive Producer"));
        } else if (thisLayer.name == "Text Producer LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text Producer LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(INPUT_TEXT_PRODUCER_LTR.join("\r"));
        } else if (thisLayer.name == "Text Producer RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(INPUT_TEXT_PRODUCER_RTL.join("\r"));
        } else if (thisLayer.name == "Text On Demand LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text On Demand LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(jsx.getCreditsDefaults("On Demand"));
        } else if (thisLayer.name == "Text On Demand 1 RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("On Demand 1"));
        } else if (thisLayer.name == "Text On Demand 2 RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("On Demand 2"));
        } else if (thisLayer.name == "Text In Touch LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "On Demand" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(jsx.getCreditsDefaults("In Touch"));
        } else if (thisLayer.name == "Text In Touch RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("In Touch"));
        } else if (thisLayer.name == "Text Social Media LTR" && jsx.getAlphabet() == "latin" || thisLayer.name == "Text Social Media LTR" && jsx.getAlphabet() == "cyrillic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Instagram") + "\r" + jsx.getCreditsDefaults("YouTube") + "\r" + jsx.getCreditsDefaults("TikTok"));
        } else if (thisLayer.name == "Text Social Media RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(jsx.getCreditsDefaults("Instagram") + "\r" + jsx.getCreditsDefaults("YouTube") + "\r" + jsx.getCreditsDefaults("TikTok"));
        }
    },
    creditsTextPosition: function () {
        thisLayer.posterizeTime(0);
        if (thisLayer.name == "Text Team Headline LTR") {
            return [225, 269];
        } else if (thisLayer.name == "Text Team Headline RTL") {
            return [1688, 269];
        } else if (thisLayer.name == "Text Team LTR") {
            return [225, 325.5];
        } else if (thisLayer.name == "Text Team RTL") {
            return [1688, 362];
        } else if (thisLayer.name == "Text Producer Headline LTR") {
            return [225, 725];
        } else if (thisLayer.name == "Text Producer Headline RTL") {
            return [1688, 340];
        } else if (thisLayer.name == "Text Producer LTR") {
            return [225, 781];
        } else if (thisLayer.name == "Text Producer RTL") {
            return [1688, 447];
        } else if (thisLayer.name == "Text In Touch LTR") {
            return [221, 269];
        } else if (thisLayer.name == "Text In Touch RTL") {
            return [1679, 275];
        } else if (thisLayer.name == "Text Social Media LTR" && jsx.getLanguage() != "spanish" && jsx.getAlphabet() != "cyrillic") {
            return [299, 506];
        } else if (thisLayer.name == "Text Social Media LTR" && jsx.getLanguage() == "spanish" || thisLayer.name == "Text Social Media LTR" && jsx.getAlphabet() == "cyrillic") {
            return [302, 410];
        } else if (thisLayer.name == "Text Social Media RTL") {
            return [1675, 506];
        } else if (thisLayer.name == "Text Copyright LTR") {
            return [221, 781];
        } else if (thisLayer.name == "Text Copyright RTL") {
            return [1676, 782];
        }
    },
    creditsPage1Opacity: function () {
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let endTime;
        if (TIME == 1) {
            endTime = 4.52;
        } else if (TIME == 2) {
            endTime = 6.92;
        } else if (TIME == 3) {
            endTime = 7.88;
        } else if (TIME == 4) {
            endTime = 9.4;
        }
        if (thisLayer.time <= 0.28) {
            return thisLayer.ease(thisLayer.time, -0.04, 0.28, 0, 84);
        } else if (thisLayer.time < endTime) {
            return 84;
        } else {
            return 0;
        }
    },
    creditsPage2LogoOpacity: function () {
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let startTime;
        let endTime;
        if (TIME == 1) {
            startTime = 4.52;
            endTime = 8.28;
        } else if (TIME == 2) {
            startTime = 6.92;
            endTime = 13.08;
        } else if (TIME == 3) {
            startTime = 7.88;
            endTime = 15;
        } else if (TIME == 4) {
            startTime = 9.4;
            endTime = 18.04;
        }
        if (jsx.getAlphabet() != "arabic" && thisLayer.time >= startTime && thisLayer.time < endTime) {
            return 84;
        } else {
            return 0;
        }
    },
    creditsPage2Opacity: function () {
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let startTime;
        let endTime;
        if (TIME == 1) {
            startTime = 4.52;
            endTime = 8.28;
        } else if (TIME == 2) {
            startTime = 6.92;
            endTime = 13.08;
        } else if (TIME == 3) {
            startTime = 7.88;
            endTime = 15;
        } else if (TIME == 4) {
            startTime = 9.4;
            endTime = 18.04;
        }
        if (thisLayer.name.slice(0, 4) != "Text" && jsx.getAlphabet() == "arabic") {
            return 0;
        } else if (thisLayer.time >= startTime && thisLayer.time < endTime) {
            return 84;
        } else {
            return 0;
        }
    },
    creditsPage3Opacity: function () {
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let startTime;
        let endTime;
        if (TIME == 1) {
            startTime = 8.28;
            endTime = 13.08;
        } else if (TIME == 2) {
            startTime = 13.08;
            endTime = 20.36;
        } else if (TIME == 3) {
            startTime = 15;
            endTime = 23.24;
        } else if (TIME == 4) {
            startTime = 18.04;
            endTime = 27.8;
        }
        if (jsx.getLanguage() == "russian" && thisLayer.name == "InstagramIcon" || jsx.getLanguage() == "russian" && thisLayer.name == "TikTokIcon" || jsx.getLanguage() != "russian" && thisLayer.name == "YouTubeIcon 2" || jsx.getLanguage() != "russian" && thisLayer.name == "WebIcon") {
            return 0;
        } else if (thisLayer.time >= startTime && thisLayer.time < endTime) {
            return 84;
        } else {
            return 0;
        }
    },
    creditsBackgroundPosition: function () {
        thisLayer.posterizeTime(0);
        if (jsx.getAlphabet() != "arabic") {
            return [125, 838];
        } else {
            return [996, 838];
        }
    },
    creditsBackgroundSize: function () {
        thisLayer.posterizeTime(0);
        return [796, 658];
    },
    creditsBackgroundOpacity: function () {
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let endTime;
        if (TIME == 1) {
            endTime = 13.08;
        } else if (TIME == 2) {
            endTime = 20.36;
        } else if (TIME == 3) {
            endTime = 23.24;
        } else if (TIME == 4) {
            endTime = 27.8;
        }
        if (thisLayer.time < endTime) {
            return thisLayer.ease(thisLayer.time, -0.04, 0.28, 0, 84);
        } else {
            return 0;
        }

    },
    creditsCopyrightYear: function () {
        const ALPHABET = jsx.getAlphabet();
        let copyrightYear = new Date().getFullYear();
        if (thisComp.layer("UI Input").effect("Copyright")(1) == 1) {
            copyrightYear = copyrightYear - 1;
        } else if (thisComp.layer("UI Input").effect("Copyright")(1) == 3) {
            copyrightYear = copyrightYear + 1;
        }
        if (thisLayer.name == "Text Copyright LTR" && ALPHABET != "arabic") {
            return jsx.setStyle("© Deutsche Welle " + copyrightYear);
        } else if (thisLayer.name == "Text Copyright RTL" && ALPHABET == "arabic") {
            return jsx.setStyle("© Deutsche Welle " + copyrightYear);
        }
    },
    creditsLogoOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        const TIME = thisComp.layer("UI Input").effect("Time")(1);
        let endTime;
        if (TIME == 1) {
            endTime = 13.08;
        } else if (TIME == 2) {
            endTime = 20.36;
        } else if (TIME == 3) {
            endTime = 23.24;
        } else if (TIME == 4) {
            endTime = 27.8;
        }
        if (thisLayer.name == "GLUS Logo AR.mov" && LANGUAGE == "arabic") {
            return 100;
        } else if (thisLayer.name == "GLUS Logo ES.mov" && LANGUAGE == "spanish") {
            return 100;
        } else if (thisLayer.name == "GLUS Logo EN.mov" && LANGUAGE != "spanish" && LANGUAGE != "arabic") {
            if (thisLayer.time < endTime) {
                return 100;
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    },
    creditsSocialMediaIconPosition: function () {
        const LANGUAGE = jsx.getLanguage();
        if (thisLayer.name == "InstagramIcon" && LANGUAGE == "arabic") {
            return [1372, 494];
        } else if (thisLayer.name == "InstagramIcon" && LANGUAGE == "english") {
            return [250, 494];
        } else if (thisLayer.name == "InstagramIcon" && LANGUAGE == "german") {
            return [250, 494];
        } else if (thisLayer.name == "InstagramIcon" && LANGUAGE == "russian") {
            return [250, 494];
        } else if (thisLayer.name == "WebIcon") {
            return [250, 394];
        } else if (thisLayer.name == "InstagramIcon" && LANGUAGE == "spanish") {
            return [250, 397];
        } else if (thisLayer.name == "InstagramIcon" && LANGUAGE == "ukrainian") {
            return [250, 399];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "arabic") {
            return [1394, 564];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "english") {
            return [250, 564];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "german") {
            return [250, 564];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "russian") {
            return [250, 469];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "spanish") {
            return [250, 467];
        } else if (thisLayer.name == "YouTubeIcon" && LANGUAGE == "ukrainian") {
            return [250, 467];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "arabic") {
            return [1375, 632];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "english") {
            return [252, 632];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "german") {
            return [252, 632];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "russian") {
            return [252, 632];
        } else if (thisLayer.name == "YouTubeIcon 2") {
            return [250, 541];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "spanish") {
            return [252, 535];
        } else if (thisLayer.name == "TikTokIcon" && LANGUAGE == "ukrainian") {
            return [252, 537];
        }
    },
    creditsLogoTimeRemap: function () {
        if (thisLayer.time < 2.08) {
            return thisLayer.time + 0.08;
        } else {
            return 2.08;
        }
    },

    // Transition Report
    transitionReportText: function () {
        thisLayer.posterizeTime(0);
        const UI_INPUT_CAMERA_TEXT = thisComp.layer("UI Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const UI_INPUT_REPORT_TEXT = thisComp.layer("UI Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const UI_INPUT_HEADLINE_TEXT = thisComp.layer("UI Input Headline Text").text.sourceText.replace(/\s+$/g, '').toUpperCase().split("\r").filter(x => x !== '');
        const UI_INPUT_SUBHEADLINE_TEXT = thisComp.layer("UI Input Subheadline Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const ALPHABET = jsx.getAlphabet();
        if (UI_INPUT_REPORT_TEXT.length < 2 && UI_INPUT_CAMERA_TEXT.length < 2 || UI_INPUT_REPORT_TEXT.length < 3 && UI_INPUT_CAMERA_TEXT.length < 1 || UI_INPUT_REPORT_TEXT.length < 1 && UI_INPUT_CAMERA_TEXT.length < 3) {
            if (thisLayer.name == "Text Camera Headline LTR" && ALPHABET != "arabic" && UI_INPUT_CAMERA_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Camera"));
            } else if (thisLayer.name == "Text Camera Headline RTL" && ALPHABET == "arabic" && UI_INPUT_CAMERA_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Camera"));
            } else if (thisLayer.name == "Text Camera LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_CAMERA_TEXT.join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Camera RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_CAMERA_TEXT.join("\r"));
            } else if (thisLayer.name == "Text Report Headline LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Report"));
            } else if (thisLayer.name == "Text Report Headline RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Report"));
            } else if (thisLayer.name == "Text Report LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_REPORT_TEXT.join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Report RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_REPORT_TEXT.join("\r"));
            }
        } else {

            if (thisLayer.name == "Text Camera Headline Small LTR" && ALPHABET != "arabic" && UI_INPUT_CAMERA_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Camera"));
            } else if (thisLayer.name == "Text Camera Headline Small RTL" && ALPHABET == "arabic" && UI_INPUT_CAMERA_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Camera"));
            } else if (thisLayer.name == "Text Camera Small LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_CAMERA_TEXT.join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Camera Small RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_CAMERA_TEXT.join("\r"));
            } else if (thisLayer.name == "Text Report Headline Small LTR" && ALPHABET != "arabic" && UI_INPUT_REPORT_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Report"));
            } else if (thisLayer.name == "Text Report Headline Small RTL" && ALPHABET == "arabic" && UI_INPUT_REPORT_TEXT.length > 0) {
                return jsx.setStyle(jsx.getTransitionReportDefaults("Report"));
            } else if (thisLayer.name == "Text Report Small LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_REPORT_TEXT.join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Report Small RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_REPORT_TEXT.join("\r"));
            } else if (thisLayer.name == "Text Headline Small LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_HEADLINE_TEXT.join("\r"));
            } else if (thisLayer.name == "Text Headline Small RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_HEADLINE_TEXT.join("\r"));
            } else if (thisLayer.name == "Text Subheadline Small LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(UI_INPUT_SUBHEADLINE_TEXT);
            } else if (thisLayer.name == "Text Subheadline Small RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(UI_INPUT_SUBHEADLINE_TEXT);
            }
        }
        if (thisLayer.name == "Text Headline LTR" && ALPHABET != "arabic") {
            return jsx.setStyle(UI_INPUT_HEADLINE_TEXT.join("\r"));
        } else if (thisLayer.name == "Text Headline RTL" && ALPHABET == "arabic") {
            return jsx.setStyle(UI_INPUT_HEADLINE_TEXT.join("\r"));
        } else if (thisLayer.name == "Text Subheadline LTR" && ALPHABET != "arabic") {
            return jsx.setStyle(UI_INPUT_SUBHEADLINE_TEXT.join("\r"));
        } else if (thisLayer.name == "Text Subheadline RTL" && ALPHABET == "arabic") {
            return jsx.setStyle(UI_INPUT_SUBHEADLINE_TEXT.join("\r"));
        }
    },
    transitionReportTextPosition: function () {
        thisLayer.posterizeTime(0);
        const ALPHABET = jsx.getAlphabet();
        const INPUT_CAMERA_TEXT_LENGTH = thisComp.layer("UI Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_REPORT_TEXT_LENGTH = thisComp.layer("UI Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_HEADLINE_TEXT_LENGTH = thisComp.layer("UI Input Headline Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_SUBHEADLINE_TEXT_LENGTH = thisComp.layer("UI Input Subheadline Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const LEADING = 56;
        const LEADING_RTL = 75;
        if (thisLayer.name == "Text Report Headline LTR") {
            return [819, 709];
        } else if (thisLayer.name == "Text Report Headline RTL") {
            return [1660, 644];
        } else if (thisLayer.name == "Text Report LTR") {
            return [819, 769];
        } else if (thisLayer.name == "Text Report RTL") {
            return [1660, 729];
        } else if (thisLayer.name == "Text Camera Headline LTR") {
            return [819, 889];
        } else if (thisLayer.name == "Text Camera Headline RTL") {
            return [1660, 857];
        } else if (thisLayer.name == "Text Camera LTR") {
            return [819, 949];
        } else if (thisLayer.name == "Text Camera RTL") {
            return [1660, 942];
        } else if (thisLayer.name == "Text Headline LTR") {
            if (ALPHABET != "cyrillic") {
                return [290, 266];
            } else {
                return [290, 266 - 8];
            }
        } else if (thisLayer.name == "Text Headline RTL") {
            return [1224, 220];
        } else if (thisLayer.name == "Text Subheadline LTR") {
            if (ALPHABET != "cyrillic") {
                return [290, 266 + thisComp.layer("Text Headline LTR").sourceRectAtTime().height + 110 + thisComp.layer("Text Headline LTR").sourceRectAtTime().top];
            } else {
                return [290, 266 + thisComp.layer("Text Headline LTR").sourceRectAtTime().height + 102 + thisComp.layer("Text Headline LTR").sourceRectAtTime().top];
            }
            
        } else if (thisLayer.name == "Text Subheadline RTL") {
            return [1224, 220 + thisComp.layer("Text Headline RTL").sourceRectAtTime().height + 83 + thisComp.layer("Text Headline RTL").sourceRectAtTime().top];
        } else if (thisLayer.name == "Text Report Headline Small LTR") {
                return [819, 709 - LEADING];
        } else if (thisLayer.name == "Text Report Headline Small RTL") {
                return [1660, 644 - 48];

        } else if (thisLayer.name == "Text Report Small LTR") {
                return [819, 709 - LEADING * 0];
        } else if (thisLayer.name == "Text Report Small RTL") {
                return [1660, 644 - 48 + LEADING_RTL];
        } else if (thisLayer.name == "Text Camera Headline Small LTR") {
            if (INPUT_REPORT_TEXT_LENGTH > 1) {
                return [819, 889 - LEADING * 1];
            } else {
                return [819, 889 - LEADING * 2];
            }
        } else if (thisLayer.name == "Text Camera Headline Small RTL") {
            if (INPUT_REPORT_TEXT_LENGTH > 1) {
                return [1660, 644 - 48 + 83 + 62 * 2];
            } else {
                return [1660, 644 - 48 + 83 + 62 * 1];
            }
        } else if (thisLayer.name == "Text Camera Small LTR") {
            if (INPUT_REPORT_TEXT_LENGTH > 1) {
                return [819, 949 - LEADING * 1];
            } else {
                return [819, 949 - LEADING * 2];
            }
        } else if (thisLayer.name == "Text Camera Small RTL") {
            if (INPUT_REPORT_TEXT_LENGTH > 1) {
                return [1660, 644 - 48 + 83 + 62 * 2 + LEADING_RTL * 1];
            } else {
                return [1660, 644 - 48 + 83 + 62 * 1 + LEADING_RTL * 1];
            }
        } else {
            return [0, 0];
        }
    },
    transitionReportTextOpacity: function () {
        const ALPHABET = jsx.getAlphabet();
        let timeShift;
        if (thisComp.name == "GLUS Transition Report") {
            timeShift = 0;
            if ((thisLayer.name == "Text Camera Headline LTR" ||
                thisLayer.name == "Text Camera LTR" ||
                thisLayer.name == "Text Report Headline LTR" ||
                thisLayer.name == "Text Report LTR" ||
                thisLayer.name == "Text Camera Headline Small LTR" ||
                thisLayer.name == "Text Camera Small LTR" ||
                thisLayer.name == "Text Report Headline Small LTR" ||
                thisLayer.name == "Text Report Small LTR") && ALPHABET != "arabic") {
                if (thisLayer.time <= 0.8) {
                    return thisLayer.ease(thisLayer.time, 0.6, 0.76, 0, 100);
                } else {
                    return thisLayer.ease(thisLayer.time, 4.04, 4.2, 100, 0);
                }
            } else if ((thisLayer.name == "Text Camera Headline RTL" ||
                thisLayer.name == "Text Camera RTL" ||
                thisLayer.name == "Text Report Headline RTL" ||
                thisLayer.name == "Text Report RTL" ||
                thisLayer.name == "Text Camera Headline Small RTL" ||
                thisLayer.name == "Text Camera Small RTL" ||
                thisLayer.name == "Text Report Headline Small RTL" ||
                thisLayer.name == "Text Report Small RTL") && ALPHABET == "arabic") {
                if (thisLayer.time <= 0.8) {
                    return thisLayer.ease(thisLayer.time, 0.6, 0.76, 0, 100);
                } else {
                    return thisLayer.ease(thisLayer.time, 4.04, 4.2, 100, 0);
                }
            }
        } else if (thisComp.name == "GLUS Transition Report Half") {
            timeShift = -4.24;
        }
        if ((thisLayer.name == "Text Headline LTR" || thisLayer.name == "Text Subheadline LTR") && ALPHABET != "arabic") {
            if (thisLayer.time <= 5.4 + timeShift) {
                return thisLayer.ease(thisLayer.time, 5.2 + timeShift, 5.36 + timeShift, 0, 100);
            } else {
                return thisLayer.ease(thisLayer.time, 8.2 + timeShift, 8.4 + timeShift, 100, 0);
            }
        } else if ((thisLayer.name == "Text Headline RTL" || thisLayer.name == "Text Subheadline RTL") && ALPHABET == "arabic") {
            if (thisLayer.time <= 5.4 + timeShift) {
                return thisLayer.ease(thisLayer.time, 5.2 + timeShift, 5.36 + timeShift, 0, 100);
            } else {
                return thisLayer.ease(thisLayer.time, 8.2 + timeShift, 8.4 + timeShift, 100, 0);
            }
        } else {
            return 0;
        }
    },
    transitionReportAnimationOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        if ((thisLayer.name == "GLUS Transition report ar.mov" || thisLayer.name == "GLUS Transition report ar_half.mov") && LANGUAGE == "arabic") {
            return 100;
        } else if ((thisLayer.name == "GLUS Transition report es.mov" || thisLayer.name == "GLUS Transition report es_half.mov") && LANGUAGE == "spanish") {
            return 100;
        } else if ((thisLayer.name == "GLUS Transition report en de uk ru.mov" || thisLayer.name == "GLUS Transition report en de uk ru_half.mov") && LANGUAGE != "spanish" && LANGUAGE != "arabic") {
            return 100;
        } else {
            return 0;
        }
    },
    transitionReportIntroductionOpacity: function () {
        const IS_INTRODUCTION = thisComp.layer("UI Input").effect("Introduction")(1).value;
        if (IS_INTRODUCTION == 1) {
            return 100;
        } else if (IS_INTRODUCTION == 0) {
            return 0;
        }
    },
    transitionReportWarning: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_HEADLINE_LENGTH = thisComp.layer("UI Input Headline Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_TEXT_SUBHEADLINE_LENGTH = thisComp.layer("UI Input Subheadline Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const TEXT_HEADLINE_WIDTH_LTR = thisComp.layer("Text Headline LTR").sourceRectAtTime().width;
        const TEXT_HEADLINE_WIDTH_RTL = thisComp.layer("Text Headline RTL").sourceRectAtTime().width;
        const TEXT_SUBHEADLINE_WIDTH_LTR = thisComp.layer("Text Subheadline LTR").sourceRectAtTime().width;
        const TEXT_SUBHEADLINE_WIDTH_RTL = thisComp.layer("Text Subheadline RTL").sourceRectAtTime().width;
        const MAX_TEXT_WIDTH_1 = 1000;
        const MAX_TEXT_WIDTH_2 = 1050;
        let message = [];
        if ((TEXT_HEADLINE_WIDTH_LTR || TEXT_HEADLINE_WIDTH_RTL) > MAX_TEXT_WIDTH_2) {
            message.push("Headline text is overflowing. Please shorten the input.");
        }
        if ((TEXT_SUBHEADLINE_WIDTH_LTR || TEXT_SUBHEADLINE_WIDTH_RTL) > MAX_TEXT_WIDTH_2) {
            message.push("Subheadline text is overflowing.\rPlease shorten the input.");
        }
        if (INPUT_TEXT_SUBHEADLINE_LENGTH > 1 && INPUT_TEXT_HEADLINE_LENGTH > 1) {
            message.push("Subheadline text can only contain two lines,\rif headline contains not more than one line.");
        } else if (INPUT_TEXT_SUBHEADLINE_LENGTH > 2) {
            message.push("Subheadline text can not contain more than two lines.");
        }
        if (thisComp.name == "GLUS Transition Report") {
            const INPUT_TEXT_REPORT = thisComp.layer("UI Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
            const INPUT_TEXT_CAMERA = thisComp.layer("UI Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
            const TEXT_REPORT_WIDTH_LTR = thisComp.layer("Text Report LTR").sourceRectAtTime().width;
            const TEXT_REPORT_WIDTH_RTL = thisComp.layer("Text Report RTL").sourceRectAtTime().width;
            const TEXT_CAMERA_WIDTH_LTR = thisComp.layer("Text Camera LTR").sourceRectAtTime().width;
            const TEXT_CAMERA_WIDTH_RTL = thisComp.layer("Text Camera RTL").sourceRectAtTime().width;
            const TEXT_REPORT_SMALL_WIDTH_LTR = thisComp.layer("Text Report Small LTR").sourceRectAtTime().width;
            const TEXT_REPORT_SMALL_WIDTH_RTL = thisComp.layer("Text Report Small RTL").sourceRectAtTime().width;
            const TEXT_CAMERA_SMALL_WIDTH_LTR = thisComp.layer("Text Camera Small LTR").sourceRectAtTime().width;
            const TEXT_CAMERA_SMALL_WIDTH_RTL = thisComp.layer("Text Camera Small RTL").sourceRectAtTime().width;
            if (INPUT_TEXT_REPORT == "") {
                message.push("Report text can not be empty.");
            }
            if (INPUT_TEXT_REPORT.length > 2) {
                message.push("Report text can only contain two lines.");
            }
            if (INPUT_TEXT_CAMERA.length > 2) {
                message.push("Camera text can only contain two lines.");
            }
            if (INPUT_TEXT_HEADLINE_LENGTH > 2) {
                message.push("Headline text can only contain two lines.");
            }
            if ((TEXT_REPORT_WIDTH_LTR || TEXT_REPORT_WIDTH_RTL || TEXT_REPORT_SMALL_WIDTH_LTR || TEXT_REPORT_SMALL_WIDTH_RTL) > MAX_TEXT_WIDTH_1) {
                message.push("Report text is overflowing. Please shorten the input.");
            }
            if ((TEXT_CAMERA_WIDTH_LTR || TEXT_CAMERA_WIDTH_RTL || TEXT_CAMERA_SMALL_WIDTH_LTR || TEXT_CAMERA_SMALL_WIDTH_RTL) > MAX_TEXT_WIDTH_1) {
                message.push("Camera text is overflowing. Please shorten the input.");
            }
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);
    },

    ///// Last Report
    lastReportWarning: function () {
        thisLayer.posterizeTime(0);
        const ALPHABET = jsx.getAlphabet();
        const DYNAMIC_TEXT_POSITION = thisComp.layer("UI Input").effect("Dynamic Text Position")(1).value;
        const VARIANT = thisComp.layer("UI Input").effect("Variant")(1).value;
        const INPUT_TEXT_REPORT_LENGTH = thisComp.layer("Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_TEXT_CAMERA_LENGTH = thisComp.layer("Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const REPORT_HEADLINE_WIDTH_LTR = thisComp.layer("Text Report Headline LTR").sourceRectAtTime().width;
        const REPORT_HEADLINE_SMALL_WIDTH_LTR = thisComp.layer("Text Report Headline Small LTR").sourceRectAtTime().width;
        const REPORT_HEADLINE_WIDTH_RTL = thisComp.layer("Text Report Headline RTL").sourceRectAtTime().width;
        const REPORT_HEADLINE_SMALL_WIDTH_RTL = thisComp.layer("Text Report Headline Small RTL").sourceRectAtTime().width;
        const REPORT_WIDTH_LTR = thisComp.layer("Text Report LTR").sourceRectAtTime().width;
        const REPORT_SMALL_WIDTH_LTR = thisComp.layer("Text Report Small LTR").sourceRectAtTime().width;
        const REPORT_WIDTH_RTL = thisComp.layer("Text Report RTL").sourceRectAtTime().width;
        const REPORT_SMALL_WIDTH_RTL = thisComp.layer("Text Report Small RTL").sourceRectAtTime().width;
        const CAMERA_HEADLINE_WIDTH_LTR = thisComp.layer("Text Camera Headline LTR").sourceRectAtTime().width;
        const CAMERA_HEADLINE_SMALL_WIDTH_LTR = thisComp.layer("Text Camera Headline Small LTR").sourceRectAtTime().width;
        const CAMERA_HEADLINE_WIDTH_RTL = thisComp.layer("Text Camera Headline RTL").sourceRectAtTime().width;
        const CAMERA_HEADLINE_SMALL_WIDTH_RTL = thisComp.layer("Text Camera Headline Small RTL").sourceRectAtTime().width;
        const CAMERA_WIDTH_LTR = thisComp.layer("Text Camera LTR").sourceRectAtTime().width;
        const CAMERA_SMALL_WIDTH_LTR = thisComp.layer("Text Camera Small LTR").sourceRectAtTime().width;
        const CAMERA_WIDTH_RTL = thisComp.layer("Text Camera RTL").sourceRectAtTime().width;
        const CAMERA_SMALL_WIDTH_RTL = thisComp.layer("Text Camera Small RTL").sourceRectAtTime().width;
        let message = [];
        // 30 pixels space
        if (VARIANT == 2) {
            if (DYNAMIC_TEXT_POSITION == false && (Math.max(REPORT_HEADLINE_WIDTH_LTR, REPORT_HEADLINE_SMALL_WIDTH_LTR, REPORT_WIDTH_LTR, REPORT_SMALL_WIDTH_LTR) > 621 ||
                Math.max(REPORT_HEADLINE_WIDTH_RTL, REPORT_HEADLINE_SMALL_WIDTH_RTL, REPORT_WIDTH_RTL, REPORT_SMALL_WIDTH_RTL) > 545 ||
                Math.max(CAMERA_HEADLINE_WIDTH_LTR, CAMERA_HEADLINE_SMALL_WIDTH_LTR, CAMERA_WIDTH_LTR, CAMERA_SMALL_WIDTH_LTR) > 525 ||
                Math.max(CAMERA_HEADLINE_WIDTH_RTL, CAMERA_HEADLINE_SMALL_WIDTH_RTL, CAMERA_WIDTH_RTL, CAMERA_SMALL_WIDTH_RTL) > 608)) {
                message.push("Text is overflowing. Please shorten the input,\ruse dynamic text position or small font.");
            } else if (DYNAMIC_TEXT_POSITION == true && (Math.max(REPORT_HEADLINE_WIDTH_LTR + 60 + CAMERA_HEADLINE_WIDTH_LTR, REPORT_HEADLINE_SMALL_WIDTH_LTR + 60 + CAMERA_HEADLINE_SMALL_WIDTH_LTR,
                REPORT_WIDTH_LTR + 60 + CAMERA_WIDTH_LTR, REPORT_SMALL_WIDTH_LTR + 60 + CAMERA_SMALL_WIDTH_LTR,
                REPORT_HEADLINE_WIDTH_RTL + 60 + CAMERA_HEADLINE_WIDTH_RTL, REPORT_HEADLINE_SMALL_WIDTH_RTL + 60 + CAMERA_HEADLINE_SMALL_WIDTH_RTL,
                REPORT_WIDTH_RTL + 60 + CAMERA_WIDTH_RTL, REPORT_SMALL_WIDTH_RTL + 60 + CAMERA_SMALL_WIDTH_RTL
            ) > 1261 - 90)) {
                message.push("Text is overflowing. Please shorten the input\ror use small font.");
            }
        } else {
            if (DYNAMIC_TEXT_POSITION == false && (Math.max(REPORT_HEADLINE_WIDTH_LTR, REPORT_HEADLINE_SMALL_WIDTH_LTR, REPORT_WIDTH_LTR, REPORT_SMALL_WIDTH_LTR) > 621 ||
                Math.max(REPORT_HEADLINE_WIDTH_RTL, REPORT_HEADLINE_SMALL_WIDTH_RTL, REPORT_WIDTH_RTL, REPORT_SMALL_WIDTH_RTL) > 545 ||
                Math.max(CAMERA_HEADLINE_WIDTH_LTR, CAMERA_HEADLINE_SMALL_WIDTH_LTR, CAMERA_WIDTH_LTR, CAMERA_SMALL_WIDTH_LTR) > 525 ||
                Math.max(CAMERA_HEADLINE_WIDTH_RTL, CAMERA_HEADLINE_SMALL_WIDTH_RTL, CAMERA_WIDTH_RTL, CAMERA_SMALL_WIDTH_RTL) > 608)) {
                message.push("Text is overflowing. Please shorten the input,\ror use dynamic text position.");
            } else if (DYNAMIC_TEXT_POSITION == true && (Math.max(REPORT_HEADLINE_WIDTH_LTR + 60 + CAMERA_HEADLINE_WIDTH_LTR, REPORT_HEADLINE_SMALL_WIDTH_LTR + 60 + CAMERA_HEADLINE_SMALL_WIDTH_LTR,
                REPORT_WIDTH_LTR + 60 + CAMERA_WIDTH_LTR, REPORT_SMALL_WIDTH_LTR + 60 + CAMERA_SMALL_WIDTH_LTR,
                REPORT_HEADLINE_WIDTH_RTL + 60 + CAMERA_HEADLINE_WIDTH_RTL, REPORT_HEADLINE_SMALL_WIDTH_RTL + 60 + CAMERA_HEADLINE_SMALL_WIDTH_RTL,
                REPORT_WIDTH_RTL + 60 + CAMERA_WIDTH_RTL, REPORT_SMALL_WIDTH_RTL + 60 + CAMERA_SMALL_WIDTH_RTL
            ) > 1261 - 90)) {
                message.push("Text is overflowing. Please shorten the input.");
            }
        }
        if (VARIANT == 1 && INPUT_TEXT_REPORT_LENGTH > 4) {
            message.push("Function 1 names can only contain four lines.");
        }
        if (VARIANT == 1 && INPUT_TEXT_CAMERA_LENGTH > 2) {
            message.push("Function 2 names can only contain two lines.");
        }
        if (VARIANT == 2 && INPUT_TEXT_REPORT_LENGTH > 2) {
            message.push("Function 1 names can only contain two lines.\rFor more names select small font variant.");
        }
        if (VARIANT == 2 && INPUT_TEXT_CAMERA_LENGTH > 1) {
            message.push("Function 2 names can only contain one line.\rFor more names select small font variant.");
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);
    },
    lastReportBanderoleSize: function () {
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (LANGUAGE != "arabic") {
            if (ANIMATE < 3) {
                return thisLayer.linear(thisLayer.time, 0.52, 0.92, [0, 193], [1261, 193]);
            } else {
                return [1261, 193];
            }
        } else {
            if (ANIMATE < 3) {
                return thisLayer.linear(thisLayer.time, 0.52, 0.92, [0, 230], [1261, 230]);
            } else {
                return [1261, 230];
            }
        }
    },
    lastReportBanderolePosition: function () {
        thisLayer.posterizeTime(0);
        const LANGUAGE = jsx.getLanguage();
        if (LANGUAGE != "arabic") {
            return [504, 875.5];
        } else {
            return [1422, 855];
        }
    },
    lastReportBanderoleAnchorPoint: function () {
        const LANGUAGE = jsx.getLanguage();
        const offset = thisLayer.content("Rectangle Path 1").size[0] / 2;
        if (LANGUAGE != "arabic") {
            return [-offset, 0];
        } else {
            return [offset, 0];
        }
    },
    lastReportBanderoleOpacity: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        let fade = 0;
        if (ANIMATE == 1 || ANIMATE == 3) {
            fade = thisLayer.linear(thisLayer.time, 5.6, 6, 86, 0);
        } else {
            fade = 86;
        }
        return fade;
    },
    lastReportText: function () {
        thisLayer.posterizeTime(0);
        const INPUT_CAMERA_TEXT = thisComp.layer("Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const INPUT_REPORT_TEXT = thisComp.layer("Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const INPUT_FUNCTION_1_TEXT = thisComp.layer("Input Function 1").text.sourceText.replace(/\s+$/g, '');
        const INPUT_FUNCTION_2_TEXT = thisComp.layer("Input Function 2").text.sourceText.replace(/\s+$/g, '');
        const ALPHABET = jsx.getAlphabet();
        const VARIANT = thisComp.layer("UI Input").effect("Variant")(1).value;
        if (VARIANT == 2) {
            if (thisLayer.name == "Text Camera Headline LTR" && ALPHABET != "arabic" && INPUT_CAMERA_TEXT.length > 0  && INPUT_REPORT_TEXT.length < 2) {
                let text;
                if (INPUT_FUNCTION_2_TEXT != "") {
                    text = INPUT_FUNCTION_2_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Camera");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Camera Headline RTL" && ALPHABET == "arabic" && INPUT_CAMERA_TEXT.length > 0 && INPUT_REPORT_TEXT.length < 2) {
                let text;
                if (INPUT_FUNCTION_2_TEXT != "") {
                    text = INPUT_FUNCTION_2_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Camera");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Camera LTR" && ALPHABET != "arabic") {
                if (INPUT_REPORT_TEXT.length > 1) {
                    return jsx.setStyle(INPUT_REPORT_TEXT.slice(1, INPUT_REPORT_TEXT.length).join("\r").toUpperCase());
                } else {
                    return jsx.setStyle(INPUT_CAMERA_TEXT.join("\r").toUpperCase());
                }
            } else if (thisLayer.name == "Text Camera RTL" && ALPHABET == "arabic") {
                if (INPUT_REPORT_TEXT.length > 1) {
                    return jsx.setStyle(INPUT_REPORT_TEXT.slice(1, INPUT_REPORT_TEXT.length).join("\r"));
                } else {
                    return jsx.setStyle(INPUT_CAMERA_TEXT.join("\r"));
                }
            } else if (thisLayer.name == "Text Report Headline LTR" && ALPHABET != "arabic") {
                let text;
                if (INPUT_FUNCTION_1_TEXT != "") {
                    text = INPUT_FUNCTION_1_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Report");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Report Headline RTL" && ALPHABET == "arabic") {
                let text;
                if (INPUT_FUNCTION_1_TEXT != "") {
                    text = INPUT_FUNCTION_1_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Report");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Report LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(INPUT_REPORT_TEXT.slice(0, Math.min(INPUT_REPORT_TEXT.length, 1)).join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Report RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(INPUT_REPORT_TEXT.slice(0, Math.min(INPUT_REPORT_TEXT.length, 1)).join("\r"));
            }
        } else {
            if (thisLayer.name == "Text Camera Headline Small LTR" && ALPHABET != "arabic" && INPUT_CAMERA_TEXT.length > 0 && INPUT_REPORT_TEXT.length < 3) {
                let text;
                if (INPUT_FUNCTION_2_TEXT != "") {
                    text = INPUT_FUNCTION_2_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Camera");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Camera Headline Small RTL" && ALPHABET == "arabic" && INPUT_CAMERA_TEXT.length > 0 && INPUT_REPORT_TEXT.length < 3) {
                let text;
                if (INPUT_FUNCTION_2_TEXT != "") {
                    text = INPUT_FUNCTION_2_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Camera");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Camera Small LTR" && ALPHABET != "arabic") {
                if (INPUT_REPORT_TEXT.length > 2) {
                    return jsx.setStyle(INPUT_REPORT_TEXT.slice(2, INPUT_REPORT_TEXT.length).join("\r").toUpperCase());
                } else {
                    return jsx.setStyle(INPUT_CAMERA_TEXT.join("\r").toUpperCase());
                }
            } else if (thisLayer.name == "Text Camera Small RTL" && ALPHABET == "arabic") {
                if (INPUT_REPORT_TEXT.length > 2) {
                    return jsx.setStyle(INPUT_REPORT_TEXT.slice(2, INPUT_REPORT_TEXT.length).join("\r"));
                } else {
                    return jsx.setStyle(INPUT_CAMERA_TEXT.join("\r"));
                }
            } else if (thisLayer.name == "Text Report Headline Small LTR" && ALPHABET != "arabic") {
                let text;
                if (INPUT_FUNCTION_1_TEXT != "") {
                    text = INPUT_FUNCTION_1_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Report");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Report Headline Small RTL" && ALPHABET == "arabic") {
                let text;
                if (INPUT_FUNCTION_1_TEXT != "") {
                    text = INPUT_FUNCTION_1_TEXT;
                } else {
                    text = jsx.getLastReportDefaults("Report");
                }
                return jsx.setStyle(text);
            } else if (thisLayer.name == "Text Report Small LTR" && ALPHABET != "arabic") {
                return jsx.setStyle(INPUT_REPORT_TEXT.slice(0, Math.min(INPUT_REPORT_TEXT.length, 2)).join("\r").toUpperCase());
            } else if (thisLayer.name == "Text Report Small RTL" && ALPHABET == "arabic") {
                return jsx.setStyle(INPUT_REPORT_TEXT.slice(0, Math.min(INPUT_REPORT_TEXT.length, 2)).join("\r"));
            }
        }
    },
    lastReportTextPosition: function () {
        thisLayer.posterizeTime(0);
        const ALPHABET = jsx.getAlphabet();
        const DYNAMIC_TEXT_POSITION = thisComp.layer("UI Input").effect("Dynamic Text Position")(1).value;
        const INPUT_CAMERA_TEXT_LENGTH = thisComp.layer("Input Camera Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_REPORT_TEXT_LENGTH = thisComp.layer("Input Report Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const REPORT_X_POSITION_LTR = 559;
        const REPORT_X_POSITION_RTL = 1374;
        let CAMERA_X_POSITION_LTR;
        let CAMERA_X_POSITION_RTL;
        if (DYNAMIC_TEXT_POSITION == true && Math.max(thisComp.layer("Text Camera RTL").sourceRectAtTime().width, thisComp.layer("Text Camera Small RTL").sourceRectAtTime().width) > 608 && ALPHABET == "arabic") {
            CAMERA_X_POSITION_LTR = 1766 - Math.max(thisComp.layer("Text Camera LTR").sourceRectAtTime().width, thisComp.layer("Text Camera Small LTR").sourceRectAtTime().width) - 60;
            CAMERA_X_POSITION_RTL = 160 + Math.max(thisComp.layer("Text Camera RTL").sourceRectAtTime().width, thisComp.layer("Text Camera Small RTL").sourceRectAtTime().width) + 60;
        } else if (DYNAMIC_TEXT_POSITION == true && Math.max(thisComp.layer("Text Camera LTR").sourceRectAtTime().width, thisComp.layer("Text Camera Small LTR").sourceRectAtTime().width) > 525 && ALPHABET != "arabic") {
            CAMERA_X_POSITION_LTR = 1766 - Math.max(thisComp.layer("Text Camera LTR").sourceRectAtTime().width, thisComp.layer("Text Camera Small LTR").sourceRectAtTime().width) - 60;
            CAMERA_X_POSITION_RTL = 160 + Math.max(thisComp.layer("Text Camera RTL").sourceRectAtTime().width, thisComp.layer("Text Camera Small RTL").sourceRectAtTime().width) + 60;
        } else {
            CAMERA_X_POSITION_LTR = 1210;
            CAMERA_X_POSITION_RTL = 799;
        }
        if (thisLayer.name == "Text Report Headline LTR") {
            return [REPORT_X_POSITION_LTR, 863];
        } else if (thisLayer.name == "Text Report Headline Small LTR") {
            if (INPUT_REPORT_TEXT_LENGTH < 2) {
                return [REPORT_X_POSITION_LTR, 886];
            } else {
                return [REPORT_X_POSITION_LTR, 830];
            }
        } else if (thisLayer.name == "Text Report Headline RTL") {
            return [REPORT_X_POSITION_RTL, 841];
        } else if (thisLayer.name == "Text Report Headline Small RTL") {
            if (INPUT_REPORT_TEXT_LENGTH < 2) {
                return [REPORT_X_POSITION_RTL, 865];
            } else {
                return [REPORT_X_POSITION_RTL, 797];
            }
        } else if (thisLayer.name == "Text Report LTR") {
            return [REPORT_X_POSITION_LTR, 941];
        } else if (thisLayer.name == "Text Report Small LTR") {
            if (INPUT_REPORT_TEXT_LENGTH < 2) {
                return [REPORT_X_POSITION_LTR, 941];
            } else {
                return [REPORT_X_POSITION_LTR, 886];
            }
        } else if (thisLayer.name == "Text Report RTL") {
            return [REPORT_X_POSITION_RTL, 934];
        } else if (thisLayer.name == "Text Report Small RTL") {
            if (INPUT_REPORT_TEXT_LENGTH < 2) {
                return [REPORT_X_POSITION_RTL, 934];
            } else {
                return [REPORT_X_POSITION_RTL, 865];
            }
        } else if (thisLayer.name == "Text Camera Headline LTR") {
            return [CAMERA_X_POSITION_LTR, 863];
        } else if (thisLayer.name == "Text Camera Headline Small LTR") {
            if (INPUT_CAMERA_TEXT_LENGTH < 2) {
                return [CAMERA_X_POSITION_LTR, 886];
            } else {
                return [CAMERA_X_POSITION_LTR, 830];
            }

        } else if (thisLayer.name == "Text Camera Headline RTL") {
            return [CAMERA_X_POSITION_RTL, 841];
        } else if (thisLayer.name == "Text Camera Headline Small RTL") {
            if (INPUT_CAMERA_TEXT_LENGTH < 2) {
                return [CAMERA_X_POSITION_RTL, 865];
            } else {
                return [CAMERA_X_POSITION_RTL, 797];
            }
        } else if (thisLayer.name == "Text Camera LTR") {
            return [CAMERA_X_POSITION_LTR, 941];
        } else if (thisLayer.name == "Text Camera Small LTR") {
            if (INPUT_CAMERA_TEXT_LENGTH < 2 && INPUT_REPORT_TEXT_LENGTH < 4) {
                return [CAMERA_X_POSITION_LTR, 941];
            } else {
                return [CAMERA_X_POSITION_LTR, 886];
            }
        } else if (thisLayer.name == "Text Camera RTL") {
            return [CAMERA_X_POSITION_RTL, 934];
        } else if (thisLayer.name == "Text Camera Small RTL") {
            if (INPUT_CAMERA_TEXT_LENGTH < 2) {
                return [CAMERA_X_POSITION_RTL, 934];
            } else {
                return [CAMERA_X_POSITION_RTL, 865];
            }
        } else {
            return [0, 0];
        }
    },
    lastReportTextOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (thisLayer.time <= 1.16 && LANGUAGE != "arabic" && thisLayer.name.includes("LTR")) {
            if (ANIMATE < 3) {
                return thisLayer.linear(thisLayer.time, 0.88, 1.08, 0, 100);
            } else {
                return 100;
            }
        } else if (LANGUAGE != "arabic" && thisLayer.name.includes("LTR")) {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (thisLayer.time <= 1.16 && LANGUAGE == "arabic" && thisLayer.name.includes("RTL")) {
            if (ANIMATE < 3) {
                return thisLayer.linear(thisLayer.time, 0.88, 1.08, 0, 100);
            } else {
                return 100;
            }
        } else if (LANGUAGE == "arabic" && thisLayer.name.includes("RTL")) {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else {
            return 0;
        }
    },
    lastReportLogoOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (thisLayer.name == "GLUS Logo AR.mov" && LANGUAGE == "arabic") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (thisLayer.name == "GLUS Logo EN.mov" && LANGUAGE != "arabic" && LANGUAGE != "spanish") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (thisLayer.name == "GLUS Logo ES.mov" && LANGUAGE == "spanish") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else {
            return 0;
        }
    },
    lastReportLogoTimeRemap: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (thisLayer.time < 2 && ANIMATE < 3) {
            return thisLayer.time + 0.08;
        } else {
            return 2.08;
        }
    },
    lowerThirdWarning: function () {
        thisLayer.posterizeTime(0);
        let message = [];
        const LANGUAGE = jsx.getLanguage();
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const BANDEROLE_WIDTH = thisComp.layer("Banderole").sourceRectAtTime(2).width;
        if (LANGUAGE != "arabic" && BANDEROLE_WIDTH - 60 + 504 > 1800 || LANGUAGE == "arabic" && 1422 - BANDEROLE_WIDTH + 60 < 120) {
            message.push("Text is overflowing. Please shorten the input.");
        }
        if (INPUT_TEXT_LENGTH > 2) {
            message.push("Lower third text can only contain two lines.");
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);
    },
    lowerThirdBanderoleSize: function () {
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const SCALE = thisComp.layer("Text 1 LTR").transform.scale[0] / 100
        const TEXT_1_WIDTH_LTR = thisComp.layer("Text 1 LTR").sourceRectAtTime().width * SCALE;
        const TEXT_1_WIDTH_RTL = thisComp.layer("Text 1 RTL").sourceRectAtTime().width * SCALE;
        const TEXT_2_WIDTH_LTR = thisComp.layer("Text 2 LTR").sourceRectAtTime().width * SCALE;
        const TEXT_2_WIDTH_RTL = thisComp.layer("Text 2 RTL").sourceRectAtTime().width * SCALE;
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        const MIN_WIDTH = 525;
        let width = 0;
        let height = 0;
        let additionalWidth = 120;
        if (INPUT_TEXT_LENGTH == 1 && LANGUAGE != "arabic") {
            width = Math.max(TEXT_1_WIDTH_LTR + additionalWidth, TEXT_2_WIDTH_LTR + additionalWidth, MIN_WIDTH);
            height = 96;
        } else if (INPUT_TEXT_LENGTH == 2 && LANGUAGE != "arabic") {
            width = Math.max(TEXT_1_WIDTH_LTR + additionalWidth, TEXT_2_WIDTH_LTR + additionalWidth, MIN_WIDTH);
            height = 193;
        } else if (INPUT_TEXT_LENGTH == 1 && LANGUAGE == "arabic") {
            width = Math.max(TEXT_1_WIDTH_RTL + additionalWidth, TEXT_2_WIDTH_RTL + additionalWidth, MIN_WIDTH);
            height = 102;
        } else if (INPUT_TEXT_LENGTH == 2 && LANGUAGE == "arabic") {
            width = Math.max(TEXT_1_WIDTH_RTL + additionalWidth, TEXT_2_WIDTH_RTL + additionalWidth, MIN_WIDTH);
            height = 230;
        }
        if (ANIMATE < 3) {
            return [thisLayer.linear(thisLayer.time, 0.6, 1, 0, width), height];
        } else {
            return [width, height];
        }
    },
    lowerThirdBanderolePosition: function () {
        thisLayer.posterizeTime(0);
        const LANGUAGE = jsx.getLanguage();
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        if (LANGUAGE != "arabic") {
            if (INPUT_TEXT_LENGTH < 2) {
                return [504, 874];
            } else {
                return [504, 778];
            }
        } else if (LANGUAGE == "arabic") {
            if (INPUT_TEXT_LENGTH < 2) {
                return [1422, 868];
            } else {
                return [1422, 740];
            }
        }
    },
    lowerThirdBanderoleAnchorPoint: function () {
        const LANGUAGE = jsx.getLanguage();
        const OFFSET_X = thisLayer.content("Rectangle Path 1").size[0] / 2;
        const OFFSET_Y = thisLayer.content("Rectangle Path 1").size[1] / 2;
        if (LANGUAGE != "arabic") {
            return [-OFFSET_X, -OFFSET_Y];
        } else {
            return [OFFSET_X, -OFFSET_Y];
        }
    },
    lowerThirdBanderoleOpacity: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        let fade = 0;
        if (ANIMATE == 1 || ANIMATE == 3 && thisLayer.time > 0.64) {
            fade = thisLayer.linear(thisLayer.time, 5.6, 6, 86, 0);
        } else {
            fade = 86;
        }
        return fade;
    },
    lowerThirdLogoOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (thisLayer.name == "GLUS Logo AR.mov" && LANGUAGE == "arabic") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (thisLayer.name == "GLUS Logo EN.mov" && LANGUAGE != "arabic" && LANGUAGE != "spanish") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (thisLayer.name == "GLUS Logo ES.mov" && LANGUAGE == "spanish") {
            if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else {
            return 0;
        }
    },
    lowerThirdText: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const LANGUAGE = jsx.getLanguage();
        const CROSSPROMOTION = thisComp.layer("UI Input").effect("Crosspromotion")(1).value;
        if (INPUT_TEXT_LENGTH > 1) {
            if (thisLayer.name == "Text 1 LTR" && LANGUAGE != "arabic") {
                return jsx.setStyle(INPUT_TEXT[0].toUpperCase());
            } else if (thisLayer.name == "Text 2 LTR" && LANGUAGE != "arabic") {
                return jsx.setStyle(INPUT_TEXT[1]);
            } else if (thisLayer.name == "Text 1 RTL" && LANGUAGE == "arabic") {
                return jsx.setStyle(INPUT_TEXT[0]);
            } else if (thisLayer.name == "Text 2 RTL" && LANGUAGE == "arabic") {
                return jsx.setStyle(INPUT_TEXT[1]);
            }
        } else {
            if (thisLayer.name == "Text 2 LTR" && CROSSPROMOTION && LANGUAGE != "arabic") {
                return jsx.setStyle(INPUT_TEXT[0]);
            } else if (thisLayer.name == "Text 2 LTR" && !CROSSPROMOTION && LANGUAGE != "arabic") {
                return jsx.setStyle(INPUT_TEXT[0].toUpperCase());
            } else if (thisLayer.name == "Text 2 RTL" && LANGUAGE == "arabic") {
                return jsx.setStyle(INPUT_TEXT[0]);
            }
        }
    },
    lowerThirdTextScale: function () {
        const MAX_WIDTH = 1236;
        const MAX_SCALE = 100;
        const MIN_SCALE = 80;
        const WIDTH_LINE_1_LTR = thisComp.layer("Text 1 LTR").sourceRectAtTime().width;
        const WIDTH_LINE_2_LTR = thisComp.layer("Text 2 LTR").sourceRectAtTime().width;
        const WIDTH_LINE_1_RTL = thisComp.layer("Text 1 RTL").sourceRectAtTime().width;
        const WIDTH_LINE_2_RTL = thisComp.layer("Text 2 RTL").sourceRectAtTime().width;
        const MAX_CURRENT_WIDTH = Math.max(WIDTH_LINE_1_LTR, WIDTH_LINE_2_LTR, WIDTH_LINE_1_RTL, WIDTH_LINE_2_RTL);
        const CALCULATED_SCALE = (MAX_WIDTH / MAX_CURRENT_WIDTH) * 100;
        const FINAL_SCALE = Math.max(Math.min(CALCULATED_SCALE, MAX_SCALE), MIN_SCALE);
        return [FINAL_SCALE, FINAL_SCALE]
    },
    lowerThirdTextPosition: function () {
        let xPositionLtr = 566;
        if (jsx.getAlphabet() == "cyrillic") {
            xPositionLtr = 550;
        }
        if (thisLayer.name == "Text 1 LTR") {
            return [xPositionLtr - thisLayer.sourceRectAtTime().left, 861];
        } else if (thisLayer.name == "Text 1 RTL") {
            return [1374, 831];
        } else if (thisLayer.name == "Text 2 LTR") {
            return [xPositionLtr - thisLayer.sourceRectAtTime().left, 941];
        } else if (thisLayer.name == "Text 2 RTL") {
            return [1374, 933];
        }
    },
    lowerThirdTextOpacity: function () {
        const LANGUAGE = jsx.getLanguage();
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (LANGUAGE != "arabic" && thisLayer.name.includes("LTR")) {
            if (ANIMATE < 3 && thisLayer.time < 5) {
                return thisLayer.linear(thisLayer.time, 0.88, 1.08, 0, 100);
            } else if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else if (LANGUAGE == "arabic" && thisLayer.name.includes("RTL")) {
            if (ANIMATE < 3 && thisLayer.time < 5) {
                return thisLayer.linear(thisLayer.time, 0.88, 1.08, 0, 100);
            } else if (ANIMATE == 1 || ANIMATE == 3) {
                return thisLayer.linear(thisLayer.time, 5.6, 6, 100, 0);
            } else {
                return 100;
            }
        } else {
            return 0;
        }
    },
    lowerThirdLogoTimeRemap: function () {
        const ANIMATE = thisComp.layer("UI Input").effect("Animation")(1).value;
        if (thisLayer.time < 2 && ANIMATE < 3) {
            return thisLayer.time + 0.08;
        } else {
            return 2.08;
        }
    },
    sourceText: function () {
        thisLayer.posterizeTime(0);
        const color = thisLayer.hexToRgb(jsx.uiValue("Color") === 1 ? "#FFFFFF" : "#000000");
        const INPUT_TEXT = thisComp.layer("Input Text").text.sourceText.trim();
        if (jsx.isActiveDirectionalLayer("Text LTR", "Text RTL")) return jsx.setStyle(INPUT_TEXT).setFillColor(color);
    },
    sourceTextPosition: function () {
        thisLayer.posterizeTime(0);
        return jsx.directionalTextPosition(120, 90, 120);
    },
    sourceTextAnchorPoint: function () {
        thisLayer.posterizeTime(0);
        return jsx.centeredAnchorPoint();
    },
    sourceTextOpacity: function () {
        return jsx.directionalTextOpacity(-0.04, 0.36, 1.04);
    },
    sourceWarning: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_LENGTH = jsx.inputLines("Input Text").length;
        const message = [];
        const TEXT_POSITION_LTR = thisComp.layer("Text LTR").transform.position[0];
        const TEXT_POSITION_RTL = thisComp.layer("Text RTL").transform.position[0];
        const TEXT_WIDTH_LTR = thisComp.layer("Text LTR").sourceRectAtTime().width;
        const TEXT_WIDTH_RTL = thisComp.layer("Text RTL").sourceRectAtTime().width;
        if (TEXT_POSITION_LTR - TEXT_WIDTH_LTR / 2 < 120 && jsx.getAlphabet() != "arabic" || TEXT_POSITION_RTL - TEXT_WIDTH_RTL / 2 < 120 && jsx.getAlphabet() == "arabic") {
            message.push("Text is overflowing. Please shorten the input.");
        }
        if (INPUT_TEXT_LENGTH > 1) {
            message.push("Source text can only contain one line.");
        }
        return jsx.warningStyle(message);
    },
    sourceShadowOpacity: function () {
        thisLayer.posterizeTime(0);
        const COLOR = thisComp.layer("UI Input").effect("Color")(1);
        if (COLOR == 1) {
            return thisLayer.linear(thisComp.layer("UI Input").effect("Shadow Opacity")(1), 0, 100, 0, 100);
        } else {
            return 0;
        }
    },
    sourceShadowSize: function () {
        thisLayer.posterizeTime(0);
        return thisLayer.text.sourceText.style.fontSize / 2;
    },
    numberOnBlackDotCircleSize: function () {
        const circleSize = jsx.uiValue("Animation") < 3
            ? thisLayer.easeIn(thisLayer.time, 0, 0.44, 500, 650)
            : 650;
        return [circleSize, circleSize];
    },
    numberOnBlackDotScale: function () {
        const isPulse = thisLayer.time > 0.44 && thisLayer.time <= 0.56 && jsx.uiValue("Animation") < 3;
        const scale = isPulse ? 115 : 100;
        return [scale, scale];
    },
    numberOnBlackDotCirclePosition: function () {
        const X_POSITION = thisComp.layer("UI Input").effect("X Position")(1).value;
        const Y_POSITION = thisComp.layer("UI Input").effect("Y Position")(1).value;
        const DIRECTION = thisComp.layer("UI Input").effect("Direction")(1).value;
        const ANIMATION = thisComp.layer("UI Input").effect("Animation")(1).value;
        let animationStepSize;
        if (ANIMATION < 3){
            if (DIRECTION == 1) {
                animationStepSize = 115.5 * 1.24 * 1.1;
            } else if (DIRECTION == 2) {
                animationStepSize = 115.5 * -1.24 * 1.1;
            }
        } else {
            animationStepSize = 0;
        }
        var interval = 0.08;
        var maxSteps = 4;
        var xRange;
        var yRange;
        if (DIRECTION == 1) {
            xRange = thisLayer.linear(X_POSITION, -100, 100, 120 + thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(0).width / 2, 1920 - 120 - thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(1).width / 2 - animationStepSize * 4);
        } else if (DIRECTION == 2) {
            xRange = thisLayer.linear(X_POSITION, -100, 100, 120 + thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(1).width / 2 - animationStepSize * 4, 1920 - 120 - thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(0).width / 2);
        }
        yRange = thisLayer.linear(Y_POSITION, -100, 100, 89 + thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(1).width / 2, 1080 - 120 - thisComp.layer("Kreis Standardgröße 2").sourceRectAtTime(1).width / 2);
        var stepsPassed = Math.floor(thisLayer.time / interval);
        var actualSteps = Math.min(stepsPassed, maxSteps);
        return [(actualSteps * animationStepSize) + xRange, yRange];
    },
    numberOnBlackDotText: function () {
        thisLayer.posterizeTime(0);
        const INPUT_NUMBER = thisComp.layer("Input Number").text.sourceText.trim();
        const INPUT_TEXT = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '');
        const FONT_SIZE = thisComp.layer("UI Input").effect("Font Size")(1);
        if (thisLayer.name == "Number LTR" && jsx.getAlphabet() != "arabic") {
            return jsx.setStyle(INPUT_NUMBER);
        } else if (thisLayer.name == "Number RTL" && jsx.getAlphabet() == "arabic") {
            return jsx.setStyle(INPUT_NUMBER);
        } else if (thisLayer.name == "Text Line 1 LTR" && jsx.getAlphabet() != "arabic" && INPUT_TEXT.length > 0) {
            return jsx.setStyle(INPUT_TEXT[0]).setFontSize(thisLayer.linear(FONT_SIZE, 0, 100, 60, 110));
        } else if (thisLayer.name == "Text Line 2 LTR" && jsx.getAlphabet() != "arabic" && INPUT_TEXT.length > 1) {
            return jsx.setStyle(INPUT_TEXT[1]).setFontSize(thisLayer.linear(FONT_SIZE, 0, 100,  60, 110));
        } else if (thisLayer.name == "Text Line 1 RTL" && jsx.getAlphabet() == "arabic" && INPUT_TEXT.length > 0) {
            return jsx.setStyle(INPUT_TEXT[0]).setFontSize(thisLayer.linear(FONT_SIZE, 0, 100,  60, 110));
        } else if (thisLayer.name == "Text Line 2 RTL" && jsx.getAlphabet() == "arabic" && INPUT_TEXT.length > 1) {
            return jsx.setStyle(INPUT_TEXT[1]).setFontSize(thisLayer.linear(FONT_SIZE, 0, 100,  60, 110));
        }
    },
    numberOnBlackDotTextAnchorPoint: function () {
        return thisComp.layer("Kreis Standardgröße 2").transform.position;
    },
    numberOnBlackDotTextPosition: function () {
        const NUMBER_BOTTOM_LTR = 25 +  50 * thisComp.layer("Number LTR").transform.scale[0] / 100 + (thisComp.layer("Number LTR").sourceRectAtTime().height +thisComp.layer("Number LTR").sourceRectAtTime().top)* thisComp.layer("Number LTR").transform.scale[0]/100;
        const NUMBER_BOTTOM_RTL = 25 + 50 * thisComp.layer("Number RTL").transform.scale[0] / 100 + (thisComp.layer("Number RTL").sourceRectAtTime().height +thisComp.layer("Number RTL").sourceRectAtTime().top)* thisComp.layer("Number LTR").transform.scale[0]/100;
        if (thisLayer.name == "Number LTR" || thisLayer.name == "Number RTL") {
            return [-(thisLayer.sourceRectAtTime(2).width / 2 + thisLayer.sourceRectAtTime(2).left) * thisLayer.transform.scale[0] / 100, +6]
        } else if (thisLayer.name == "Text Line 1 LTR") {
            return [-(thisLayer.sourceRectAtTime().width / 2 + thisLayer.sourceRectAtTime().left), NUMBER_BOTTOM_LTR - thisLayer.sourceRectAtTime().top]
        } else if (thisLayer.name == "Text Line 2 LTR") {
            return [-(thisLayer.sourceRectAtTime().width / 2 + thisLayer.sourceRectAtTime().left), - thisLayer.sourceRectAtTime().top + NUMBER_BOTTOM_LTR + thisLayer.text.sourceText.style.fontSize * 1.2]
        } else if (thisLayer.name == "Text Line 1 RTL") {
            return [-(thisLayer.sourceRectAtTime().width / 2 + thisLayer.sourceRectAtTime().left),  - thisLayer.sourceRectAtTime().top + NUMBER_BOTTOM_RTL]
        } else if (thisLayer.name == "Text Line 2 RTL") {
            return [-(thisLayer.sourceRectAtTime().width / 2 + thisLayer.sourceRectAtTime().left),  - thisLayer.sourceRectAtTime().top + NUMBER_BOTTOM_RTL + thisLayer.text.sourceText.style.fontSize * 1.2]
        }
    },
    numberOnBlackDotTextScale: function () {
        thisLayer.posterizeTime(0);
        const ALPHABET = jsx.getAlphabet();
        const FONT_SIZE = thisComp.layer("UI Input").effect("Font Size")(1);
        const CIRCLE = thisComp.layer("Kreis Standardgröße 2");
        const CIRCLE_RECT = CIRCLE.sourceRectAtTime(2);
        const CIRCLE_PADDING = 75;
        const CIRCLE_RADIUS = (CIRCLE_RECT.width - CIRCLE_PADDING) / 2;
        const CIRCLE_CENTER = CIRCLE.toComp([CIRCLE_RECT.left + CIRCLE_RECT.width / 2, CIRCLE_RECT.top + CIRCLE_RECT.height / 2]);
        const IS_NUMBER = ALPHABET != "arabic" ? thisLayer.name == "Number LTR" : thisLayer.name == "Number RTL";
        let newScale;
        if (IS_NUMBER) {
            const RECT = thisLayer.sourceRectAtTime(2);
            const CURRENT_SCALE = value[0];
            const RECT_CENTER = thisLayer.toComp([RECT.left + RECT.width / 2, RECT.top + RECT.height / 2]);
            const MAX_DISTANCE = thisLayer.length(RECT_CENTER, CIRCLE_CENTER) + Math.sqrt(RECT.width * RECT.width + RECT.height * RECT.height) * CURRENT_SCALE / 100 / 2;
            if (MAX_DISTANCE > CIRCLE_RADIUS) {
                const SCALE_FACTOR = CIRCLE_RADIUS / MAX_DISTANCE;
                const CLAMPED_FACTOR = Math.max(SCALE_FACTOR, 1 / 3);
                newScale = CURRENT_SCALE * CLAMPED_FACTOR;
            } else {
                newScale = CURRENT_SCALE;
            }
        } else {
            newScale = thisLayer.linear(FONT_SIZE, 0, 100, 54.55, 100);
        }
        return [newScale, newScale];
    },
    numberOnBlackDotOpacity: function () {
        const ALPHABET = jsx.getAlphabet();
        const ANIMATION = thisComp.layer("UI Input").effect("Animation")(1);
        let fade;
        if ((thisLayer.name == "Number LTR" || thisLayer.name == "Text Line 1 LTR" || thisLayer.name == "Text Line 2 LTR") && ALPHABET != "arabic") {
            if (thisLayer.time < 0.48 && ANIMATION < 3) {
                fade = 0;
            } else if (ANIMATION == 1 || ANIMATION == 3) {
                fade = thisLayer.ease(thisLayer.time, thisComp.duration - 0.4, thisComp.duration, 100, 0);
            } else {
                fade = 100;
            }
            return fade;
        } else if ((thisLayer.name == "Number RTL" || thisLayer.name == "Text Line 1 RTL" || thisLayer.name == "Text Line 2 RTL") && ALPHABET == "arabic") {
            if (thisLayer.time < 0.48 && ANIMATION < 3) {
                fade = 0;
            } else if (ANIMATION == 1 || ANIMATION == 3) {
                fade = thisLayer.ease(thisLayer.time, thisComp.duration - 0.4, thisComp.duration, 100, 0);
            } else {
                fade = 100;
            }
            return fade;
        } else if (thisLayer.name == "Kreis Standardgröße 2") {
            if (ANIMATION == 1 || ANIMATION == 3) {
                fade = thisLayer.ease(thisLayer.time, thisComp.duration - 0.4, thisComp.duration, 100, 0);
            } else {
                fade = 100;
            }
            return fade;
        } else {
            return 0;
        }
    },
    numberOnBlackDotWarning: function () {
        thisLayer.posterizeTime(0);
        const ALPHABET = jsx.getAlphabet();
        const INPUT_TEXT_LENGTH = thisComp.layer("Input Text").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        const INPUT_NUMBER_LENGTH = thisComp.layer("Input Number").text.sourceText.replace(/\s+$/g, '').split("\r").filter(x => x !== '').length;
        let message = [];
        const EPSILON = 0.001;
        const CIRCLE = thisComp.layer("Kreis Standardgröße 2");
        const CIRCLE_RECT = CIRCLE.sourceRectAtTime(2);
        const CIRCLE_PADDING = 75;
        const CIRCLE_RADIUS = (CIRCLE_RECT.width - CIRCLE_PADDING) / 2;
        const CIRCLE_CENTER = CIRCLE.toComp([CIRCLE_RECT.left + CIRCLE_RECT.width / 2, CIRCLE_RECT.top + CIRCLE_RECT.height / 2]);
        const DIRECTION = ALPHABET != "arabic" ? "LTR" : "RTL";
        const TEXT_LAYERS = [thisComp.layer("Number " + DIRECTION),thisComp.layer("Text Line 1 " + DIRECTION),thisComp.layer("Text Line 2 " + DIRECTION)];
        for (var i = 0; i < TEXT_LAYERS.length; i++) {
            const TEXT_LAYER = TEXT_LAYERS[i];
            const RECT = TEXT_LAYER.sourceRectAtTime(2);
            const CORNERS = [TEXT_LAYER.toComp([RECT.left, RECT.top]),
                TEXT_LAYER.toComp([RECT.left + RECT.width, RECT.top]),
                TEXT_LAYER.toComp([RECT.left, RECT.top + RECT.height]),
                TEXT_LAYER.toComp([RECT.left + RECT.width, RECT.top + RECT.height])
            ];
            for (var j = 0; j < CORNERS.length; j++) {
                const DISTANCE = thisLayer.length(CORNERS[j], CIRCLE_CENTER);
                if (DISTANCE > CIRCLE_RADIUS + EPSILON) {
                    message.push("Text is overflowing.\nPlease shorten the input or reduce font size.");
                    break;
                }
            }
            if (message.length > 0) {
                break;
            }
        }
        if (INPUT_NUMBER_LENGTH > 1) {
            message.push("Number can only contain one line.");
        }
        if (INPUT_TEXT_LENGTH > 2) {
            message.push("Text can only contain two lines.");
        }
        if (message.length > 0) {
            message = "Sorry!\r\r" + message.join("\r");
        }
        return jsx.setStyle(message);

    },
    numberFreeFloatingText: function () {
        thisLayer.posterizeTime(0);
        const color = thisLayer.hexToRgb(jsx.uiValue("Color") === 1 ? "#FFFFFF" : "#000000");
        const INPUT_TEXT = thisComp.layer("Input Text").text.sourceText.trim();
        if (!jsx.isActiveDirectionalLayer("Text LTR", "Text RTL")) return;
        return jsx.setStyle(INPUT_TEXT)
            .setFillColor(color)
            .setFontSize(thisLayer.linear(jsx.uiValue("Font Size"), 0, 100, 150, 220));
    },
    numberFreeFloatingTextOpacity: function () {
        return jsx.directionalTextOpacity(-0.04, 0.36, 1.04);
    },
    numberFreeFloatingTextPosition: function () {
        thisLayer.posterizeTime(0);
        return jsx.directionalTextPosition(120, 90, 120);
    },
    numberFreeFloatingTextAnchorPoint: function () {
        thisLayer.posterizeTime(0);
        return jsx.centeredAnchorPoint();
    },
    numberFreeFloatingWarning: function () {
        thisLayer.posterizeTime(0);
        const INPUT_TEXT_LENGTH = jsx.inputLines("Input Text").length;
        const message = [];
        const TEXT_POSITION_LTR = thisComp.layer("Text LTR").transform.position[0];
        const TEXT_POSITION_RTL = thisComp.layer("Text RTL").transform.position[0];
        const TEXT_WIDTH_LTR = thisComp.layer("Text LTR").sourceRectAtTime().width;
        const TEXT_WIDTH_RTL = thisComp.layer("Text RTL").sourceRectAtTime().width;
        if (TEXT_POSITION_LTR - TEXT_WIDTH_LTR / 2 < 120 && jsx.getAlphabet() != "arabic" || TEXT_POSITION_RTL - TEXT_WIDTH_RTL / 2 < 120 && jsx.getAlphabet() == "arabic") {
            message.push("Text is overflowing. Please shorten the input.");
        }
        if (INPUT_TEXT_LENGTH > 1) {
            message.push("Free-floating number text can only contain one line.");
        }
        return jsx.warningStyle(message);
    },
}
