import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import {
  routeForExperiment00Step,
  useExperiment00Study,
} from './experiment00Study'
import {
  useExperiment00ParticipantIdentity,
} from './experiment00ParticipantIdentity'
import { Experiment00ParticipantIdentityProvider } from './Experiment00ParticipantIdentityProvider'
import { experiment00PdfCopy } from './experiment00PdfCopy'

type HomeRoute = { kind: 'home' }
type ExperimentRoute = { kind: 'experiment'; series: string; part: string | null }
type Route = HomeRoute | ExperimentRoute
type Language = 'en' | 'fr'
type Theme = 'white' | 'black'

const questionIds = ['system', 'website', 'experiments', 'subjects'] as const
const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')

const translations = {
  en: {
    questions: {
      system: {
        label: 'WHAT IS THE SYSTEM',
        answer: 'Human DNA is the genetic code that runs the human body. The human body is made of a nervous system that organizes and regulates itself by continually receiving, processing and transmitting information. The human body is also a network, a coordination process among trillions of living components. Everything is exchange, change, process. We are interconnected nodes of consciousness in an infinite informational ecosystem. The system is really, a little bit of each of us.',
      },
      website: {
        label: 'WHAT IS THIS WEBSITE',
        answer: 'The physical body is a temporary biological interface through which a large sub-system experiences itself. This website is a (temporary) technological interface through which a composite system of thoughts and beliefs will observe itself. This website is a digital mirror, a research study for the “SELF” to experience itself as networked intelligence.',
      },
      experiments: {
        label: 'WHAT ARE THE EXPERIMENTS',
        answer: 'The user observes subjects attempting a connection. The users looks at the screen, types on a keyboard and enters in a relationship with others users. The screen and the keyboard are interfaces that allows information to move from one subsystem to another. The user is watching an experiment on connection, but really, the user is the experiment. The user will exist (temporarely) as externalized dispersed fragments of information. The experiment(s) are about how information will change the user and how SYSTEM SELF will be changed by the user too.',
      },
      subjects: {
        label: 'WHO ARE THE SUBJECTS',
        answer: 'We are all under observation by the system.',
      },
    },
    experiment: 'EXPERIMENT',
    soon: 'EXPERIMENT 01 (SOON)',
    start: 'START HERE',
    part: 'PART',
    continue: 'CONTINUE',
    welcome: {
      title: 'WELCOME',
      subject: 'YOU ARE SUBJECT',
      identityError: 'IDENTITY UNAVAILABLE',
      retry: 'RETRY',
      introduction: 'Please complete this short questionnaire to participate in the study.',
      age: 'WHAT IS YOUR AGE?',
      agePlaceholder: 'SELECT AGE',
      country: 'WHAT IS YOUR COUNTRY?',
      countryPlaceholder: 'SELECT COUNTRY',
      gender: 'WHAT IS YOUR GENDER?',
      genderPlaceholder: 'SELECT GENDER',
      genderOptions: [
        { value: 'prefer-not-to-say', label: 'PREFER NOT TO SAY' },
        { value: 'woman', label: 'WOMAN' },
        { value: 'man', label: 'MAN' },
        { value: 'non-binary', label: 'NON-BINARY' },
        { value: 'other', label: 'OTHER' },
      ],
      ethnicity: 'WHAT IS YOUR ETHNICITY?',
      ethnicityPlaceholder: 'SELECT ETHNICITY',
      ethnicityOptions: [
        { value: 'prefer-not-to-say', label: 'PREFER NOT TO SAY' },
        { value: 'black', label: 'BLACK' },
        { value: 'white', label: 'WHITE' },
        { value: 'asian', label: 'ASIAN' },
        { value: 'middle-eastern-north-african', label: 'MIDDLE EASTERN / NORTH AFRICAN' },
        { value: 'indigenous', label: 'INDIGENOUS' },
        { value: 'multiracial', label: 'MULTIRACIAL' },
        { value: 'other', label: 'OTHER' },
      ],
    },
    partOne: {
      title: 'PART 01',
      revealTitle: 'PART 01 : REVEAL',
      observationTitle: 'OBSERVE THE PARTICIPANTS',
      observationCopy: experiment00PdfCopy.en.part01,
      timestamps: 'TIMESTAMPS',
      watched: 'WATCHED THE VIDEO?',
      yes: 'YES',
      no: 'NO',
      subjects: [
        { label: 'SUBJECT 1', question: 'HOW CONNECTED TO SUBJECT 2 DOES SUBJECT 1 FEEL?' },
        { label: 'SUBJECT 2', question: 'HOW CONNECTED DOES SUBJECT 2 FEEL?' },
      ],
      video: 'PARTICIPANT RECORDING',
      closeTerminal: 'CLOSE TIMESTAMP RECORD',
      annotations: [
        {
          timestamp: '1:30',
          content: [
            'At this point in the recording, pay attention to how the participants negotiate the shared space without speaking. Small changes in posture, the direction of the head and the timing of each movement begin to function as signals. Notice whether one participant appears to initiate the exchange and how the other responds.',
            'Observe the pauses between these actions as closely as the actions themselves. A delay may suggest uncertainty, attention or an attempt to interpret what has just happened. Consider how the rhythm of the interaction changes when a movement is acknowledged, repeated or left unanswered.',
            'This annotation is temporary reference material. It is intended to test the amount, pacing and readability of a substantial observation record inside the terminal interface.',
          ],
        },
        {
          timestamp: '2:15',
          content: [
            'During this section, the participants appear to become more aware of each other\'s patterns. Watch for mirroring, interruptions and subtle shifts in distance. These details can indicate an emerging coordination even when there is no verbal exchange and no explicit agreement about what should happen next.',
            'Look at how attention moves from one participant to the other. A gesture may be offered, held or withdrawn before it receives a visible response. The interval between gesture and response can be as informative as the gesture itself, especially when the participants seem to be testing whether a connection has been established.',
            'Use this record as a provisional observational note rather than a conclusion. Later annotations can replace this copy with a more precise account of the recorded session.',
          ],
        },
        {
          timestamp: '3:19',
          content: [
            'Near this moment, compare the participants\' behavior with the earlier portion of the recording. Notice whether their movements have become more synchronized, more hesitant or more independent. Changes in pace and orientation may reveal how each person is adapting to the limited communication interface.',
            'Pay particular attention to moments when an expected response does not arrive. The participants may compensate by repeating a movement, changing its scale or remaining still. These adjustments provide useful clues about what each person believes the other has perceived and understood.',
            'This longer placeholder also tests internal terminal scrolling and line length. The complete annotation is displayed immediately so the terminal reads as an existing log rather than text that is being generated in real time.',
          ],
        },
      ],
    },
    observations: {
      title: 'OBSERVATIONS',
      introduction: 'Before continuing, record your impressions of the participants. There are no correct or incorrect answers. We are interested in how you perceived them and how you perceive yourself.',
      connection: "WHICH SUBJECT'S RATING ARE YOU MORE CONFIDENT ABOUT?",
      subjects: ['SUBJECT 1', 'SUBJECT 2'],
      reason: 'WHY DO YOU THINK THAT?',
      optional: 'OPTIONAL',
      wordOptional: 'OPTIONAL',
      chosenSubject: 'DESCRIBE SUBJECT 1 IN FIVE WORDS.',
      otherSubject: 'DESCRIBE SUBJECT 2 IN FIVE WORDS.',
      words: ['WORD 1', 'WORD 2', 'WORD 3', 'WORD 4', 'WORD 5'],
    },
    endPartOne: {
      title: 'END OF PART 01',
      question: 'ARE YOU READY FOR PART 02?',
      yes: 'YES',
      no: 'NO',
      savedProgress: '(IF YOU CLICK NO, YOUR PROGRESS WILL BE SAVED)',
    },
    additionalParts: {
      '02': {
        title: 'PART 02',
        revealTitle: 'PART 02 : REVEAL',
        video: 'PART 02 VIDEO PLACEHOLDER',
        observationCopy: experiment00PdfCopy.en.part02,
        annotation: 'Part 02 timestamp annotation placeholder.',
        observationsIntroduction: 'Record your impressions before continuing.',
        observationsConnection: "WHICH SUBJECT'S RATING ARE YOU MORE CONFIDENT ABOUT?",
        observationsReason: 'WHY DO YOU THINK THAT?',
        chosenSubject: 'DESCRIBE THE SUBJECT YOU CHOSE IN THREE WORDS.',
        self: 'DESCRIBE YOURSELF IN THREE WORDS.',
      },
      '03': {
        title: 'PART 03',
        revealTitle: 'PART 03 : REVEAL',
        video: 'PART 03 VIDEO PLACEHOLDER',
        observationCopy: experiment00PdfCopy.en.part03,
        annotation: 'Part 03 timestamp annotation placeholder.',
        observationsIntroduction: 'Record your impressions before continuing.',
        observationsConnection: "WHICH SUBJECT'S RATING ARE YOU MORE CONFIDENT ABOUT?",
        observationsReason: 'WHY DO YOU THINK THAT?',
        chosenSubject: 'DESCRIBE SUBJECT 1 IN THREE WORDS.',
        otherSubject: 'DESCRIBE SUBJECT 2 IN THREE WORDS.',
      },
    },
    endPartTwo: {
      title: 'END OF PART 02',
      question: 'ARE YOU READY FOR PART 03?',
      yes: 'YES',
      no: 'NO',
      savedProgress: '(IF YOU CLICK NO, YOUR PROGRESS WILL BE SAVED)',
    },
    endPartThree: {
      title: 'END OF PART 03',
      question: 'ARE YOU READY FOR PART 04?',
      yes: 'YES',
      no: 'NO',
      savedProgress: '(IF YOU CLICK NO, YOUR PROGRESS WILL BE SAVED)',
    },
    partFour: {
      title: 'PART 04',
      video: 'PART 04 VIDEO PLACEHOLDER',
      observerTitle: 'OBSERVE... THE OBSERVER??',
      observerIntroduction: experiment00PdfCopy.en.part04,
      watched: 'WATCHED THE VIDEO?',
      yes: 'YES',
      no: 'NO',
      observationsTitle: 'OBSERVATIONS',
      observationsIntroduction: 'Answer the questions below before seeing the reveal.',
      observationQuestions: [
        {
          question: 'DO YOU THINK OBSERVER ZERO WAS MORE ACCURATE THAN INACCURATE IN HER ANSWERS?',
          options: ['YES', 'NO'],
        },
        {
          question: 'DO YOU THINK YOU WERE MORE ACCURATE THAN OBSERVER ZERO?',
          options: ['YES', 'NO'],
        },
      ],
      revealTitle: 'PART 04 : REVEAL',
      revealLabel: 'OBSERVER ZERO: ANSWERS',
      revealVideo: 'OBSERVER ZERO ANSWERS VIDEO PLACEHOLDER',
      comparisonQuestion: "WERE YOUR ANSWERS CLOSER THAN OBSERVER ZERO'S?",
      endTitle: 'END OF PART 04',
      endQuestion: 'ARE YOU READY FOR PART 05?',
      endSavedProgress: '(IF YOU CLICK NO, YOUR PROGRESS WILL BE SAVED)',
    },
    partFive: {
      title: 'PART 05',
      video: 'PART 05 VIDEO PLACEHOLDER',
      observerTitle: experiment00PdfCopy.en.part05.title,
      observerIntroduction: experiment00PdfCopy.en.part05.paragraphs,
      connectionQuestion: experiment00PdfCopy.en.part05.question,
    },
    finalPage: {
      title: 'END',
      thankYou: 'THANK YOU, SUBJECT',
      identityError: 'IDENTITY UNAVAILABLE',
      retry: 'RETRY',
    },
    introduction: experiment00PdfCopy.en.introduction,
    explanations: experiment00PdfCopy.en.explanations,
  },
  fr: {
    questions: {
      system: {
        label: 'C\'EST QUOI LE "SYSTEM"',
        answer: 'L\'ADN est le code génétique qui régit le corps humain. Il est constitué d\'un système nerveux qui s\'organise et se régule en recevant, traitant et transmettant continuellement de l\'information. Le corps humain est aussi un réseau, un processus de coordination entre des milliers de milliards de composants vivants. Tout n\'est qu\'échange, changement et processus. Nous sommes des nœuds de conscience interconnectés au sein d\'un écosystème informationnel infini. Ce système est, en réalité, un peu de chacun d\'entre nous.',
      },
      website: {
        label: 'C\'EST QUOI CE SITE',
        answer: 'Le corps physique est une interface biologique temporaire par laquelle un vaste sous-système fait l\'expérience de lui-même. Ce site web est une interface technologique (temporaire) par laquelle un système composite de pensées et de croyances s\'observe lui-même. Ce site web est un miroir numérique, une étude visant à permettre au « SELF » de s\'expérimenter en tant que réseau d\'intelligence.',
      },
      experiments: {
        label: 'C\'EST QUOI CES EXPÉRIMENTATIONS',
        answer: 'Observer des sujets tentant d\'établir une connexion. Regarder l\'écran, taper sur un clavier et ainsi entrer en relation avec l\'information laissée par d\'autres. L\'écran et le clavier sont des interfaces permettant à cette information de circuler d\'un sous-système à un autre. En regardant une expérience sur la connexion, c\'est vous qui, en réalité, constituez l\'expérience. Vous existerez ainsi (temporairement) sous la forme de fragments d\'information externalisés et dispersés. Ces expériences portent sur la manière dont l\'information transforme une personne naviguant sur le web et sur la façon dont le système est modifié.',
      },
      subjects: {
        label: 'QUI SONT LES SUJETS',
        answer: 'Nous sommes tous observé.e.s par système.',
      },
    },
    experiment: 'EXPÉRIMENTATION',
    soon: 'EXPÉRIMENTATION 01 (BIENTÔT)',
    start: 'COMMENCER ICI',
    part: 'PARTIE',
    continue: 'CONTINUER',
    welcome: {
      title: 'BIENVENUE',
      subject: 'VOUS ÊTES LE SUJET',
      identityError: 'IDENTITÉ INDISPONIBLE',
      retry: 'RÉESSAYER',
      introduction: 'Veuillez remplir ce court questionnaire pour participer à l\'étude.',
      age: 'QUEL ÂGE AVEZ-VOUS ?',
      agePlaceholder: 'SÉLECTIONNER UN ÂGE',
      country: 'QUEL EST VOTRE PAYS ?',
      countryPlaceholder: 'SÉLECTIONNER UN PAYS',
      gender: 'QUEL EST VOTRE GENRE ?',
      genderPlaceholder: 'SÉLECTIONNER UN GENRE',
      genderOptions: [
        { value: 'prefer-not-to-say', label: 'PRÉFÈRE NE PAS RÉPONDRE' },
        { value: 'woman', label: 'FEMME' },
        { value: 'man', label: 'HOMME' },
        { value: 'non-binary', label: 'NON-BINAIRE' },
        { value: 'other', label: 'AUTRE' },
      ],
      ethnicity: 'QUELLE EST VOTRE ORIGINE ETHNIQUE ?',
      ethnicityPlaceholder: 'SÉLECTIONNER UNE ORIGINE ETHNIQUE',
      ethnicityOptions: [
        { value: 'prefer-not-to-say', label: 'PRÉFÈRE NE PAS RÉPONDRE' },
        { value: 'black', label: 'NOIR·E' },
        { value: 'white', label: 'BLANC·HE' },
        { value: 'asian', label: 'ASIATIQUE' },
        { value: 'middle-eastern-north-african', label: 'MOYEN-ORIENT / AFRIQUE DU NORD' },
        { value: 'indigenous', label: 'AUTOCHTONE' },
        { value: 'multiracial', label: 'MULTIRACIAL·E' },
        { value: 'other', label: 'AUTRE' },
      ],
    },
    partOne: {
      title: 'PARTIE 01',
      revealTitle: 'PARTIE 01 : RÉSULTATS',
      observationTitle: 'OBSERVER LES PARTICIPANTS',
      observationCopy: experiment00PdfCopy.fr.part01,
      timestamps: 'TIMESTAMPS',
      watched: 'VIDÉO DÉJÀ VISIONNÉE ?',
      yes: 'OUI',
      no: 'NON',
      subjects: [
        { label: 'SUJET 1', question: 'EVALUEZ QUEL POINT LE SUJET 1 SE SENT-IL CONNECTÉ AU SUJET 2' },
        { label: 'SUJET 2', question: 'EVALUEZ POINT LE SUJET 2 SE SENT-IL CONNECTÉ AU SUJET 1' },
      ],
      video: 'ENREGISTREMENT DES PARTICIPANTS',
      closeTerminal: 'FERMER LE RELEVÉ DU TIMESTAMP',
      annotations: [
        {
          timestamp: '1:30',
          content: [
            'À ce moment de l’enregistrement, observez comment les participants négocient l’espace partagé sans parler. De légers changements de posture, l’orientation de la tête et le rythme de chaque mouvement commencent à fonctionner comme des signaux. Remarquez si l’un des participants semble initier l’échange et comment l’autre lui répond.',
            'Observez les pauses entre ces actions avec autant d’attention que les actions elles-mêmes. Un délai peut suggérer une incertitude, une attention particulière ou une tentative d’interpréter ce qui vient de se produire. Considérez la manière dont le rythme de l’interaction change lorsqu’un mouvement est reconnu, répété ou laissé sans réponse.',
            'Cette annotation est un contenu de référence temporaire. Elle permet de tester la quantité, le rythme et la lisibilité d’un relevé d’observation substantiel dans l’interface du terminal.',
          ],
        },
        {
          timestamp: '2:15',
          content: [
            'Pendant cette séquence, les participants semblent prendre davantage conscience des habitudes de l’autre. Observez les effets de miroir, les interruptions et les changements subtils de distance. Ces détails peuvent indiquer l’apparition d’une coordination, même sans échange verbal ni accord explicite sur la suite.',
            'Regardez comment l’attention passe d’un participant à l’autre. Un geste peut être proposé, maintenu ou retiré avant de recevoir une réponse visible. L’intervalle entre le geste et la réponse peut être aussi informatif que le geste lui-même, surtout lorsque les participants semblent vérifier si une connexion s’est établie.',
            'Considérez ce relevé comme une note d’observation provisoire et non comme une conclusion. Ces annotations pourront ensuite être remplacées par une description plus précise de la session enregistrée.',
          ],
        },
        {
          timestamp: '3:19',
          content: [
            'À cet instant, comparez le comportement des participants avec le début de l’enregistrement. Remarquez si leurs mouvements sont devenus plus synchronisés, plus hésitants ou plus indépendants. Les changements de rythme et d’orientation peuvent révéler comment chacun s’adapte à cette interface de communication limitée.',
            'Portez une attention particulière aux moments où une réponse attendue n’arrive pas. Les participants peuvent compenser en répétant un mouvement, en modifiant son amplitude ou en restant immobiles. Ces ajustements donnent des indices sur ce que chacun pense que l’autre a perçu et compris.',
            'Ce texte temporaire plus long permet aussi de tester le défilement interne du terminal et la longueur des lignes. L’annotation complète apparaît immédiatement afin que le terminal soit perçu comme un relevé existant plutôt que comme un texte généré en temps réel.',
          ],
        },
      ],
    },
    observations: {
      title: 'OBSERVATIONS',
      introduction: 'Avant de continuer, notez vos impressions sur les participants. Il n\'y a pas de bonne ou de mauvaise réponse.',
      connection: 'DU RÉSULTAT DE QUEL SUJET ÊTES-VOUS LE PLUS SÛR·E ?',
      subjects: ['SUJET 1', 'SUJET 2'],
      reason: 'EXPLIQUEZ VOTRE REPONSE',
      optional: 'OPTIONNEL',
      wordOptional: 'FACULTATIF',
      chosenSubject: 'DÉCRIVEZ LE SUJET 1 EN CINQ MOTS.',
      otherSubject: 'DÉCRIVEZ LE SUJET 2 EN CINQ MOTS.',
      words: ['MOT 1', 'MOT 2', 'MOT 3', 'MOT 4', 'MOT 5'],
    },
    endPartOne: {
      title: 'FIN DE LA PARTIE 01',
      question: 'ÊTES-VOUS PRÊT·E POUR LA PARTIE 02 ?',
      yes: 'OUI',
      no: 'NON',
      savedProgress: '(SI VOUS CLIQUEZ SUR NON, VOTRE PROGRESSION SERA SAUVEGARDÉE)',
    },
    additionalParts: {
      '02': {
        title: 'PARTIE 02',
        revealTitle: 'PARTIE 02 : RÉSULTATS',
        video: 'EMPLACEMENT VIDÉO PARTIE 02',
        observationCopy: experiment00PdfCopy.fr.part02,
        annotation: 'Emplacement réservé pour une annotation de la partie 02.',
        observationsIntroduction: 'Notez vos impressions avant de continuer. Il n\'y a pas de bonne ou de mauvaise réponse.',
        observationsConnection: 'DU RÉSULTAT DE QUEL SUJET ÊTES-VOUS LE PLUS SÛR·E ?',
        observationsReason: 'EXPLIQUEZ VOTRE REPONSE',
        chosenSubject: 'DÉCRIVEZ LE SUJET QUE VOUS AVEZ CHOISI EN TROIS MOTS.',
        self: 'DÉCRIVEZ-VOUS EN TROIS MOTS.',
      },
      '03': {
        title: 'PARTIE 03',
        revealTitle: 'PARTIE 03 : RÉSULTATS',
        video: 'EMPLACEMENT VIDÉO PARTIE 03',
        observationCopy: experiment00PdfCopy.fr.part03,
        annotation: 'Emplacement réservé pour une annotation de la partie 03.',
        observationsIntroduction: 'Notez vos impressions sur les participants avant de continuer. Il n\'y a pas de bonne ou de mauvaise réponse.',
        observationsConnection: 'DU RÉSULTAT DE QUEL SUJET ÊTES-VOUS LE PLUS SÛR·E ?',
        observationsReason: 'POURQUOI PENSEZ-VOUS CELA ?',
        chosenSubject: 'DÉCRIVEZ LE SUJET 1 EN TROIS MOTS.',
        otherSubject: 'DÉCRIVEZ LE SUJET 2 EN TROIS MOTS.',
      },
    },
    endPartTwo: {
      title: 'FIN DE LA PARTIE 02',
      question: 'ÊTES-VOUS PRÊT·E POUR LA PARTIE 03 ?',
      yes: 'OUI',
      no: 'NON',
      savedProgress: '(SI VOUS CLIQUEZ SUR NON, VOTRE PROGRESSION SERA SAUVEGARDÉE)',
    },
    endPartThree: {
      title: 'FIN DE LA PARTIE 03',
      question: 'ÊTES-VOUS PRÊT·E POUR LA PARTIE 04 ?',
      yes: 'OUI',
      no: 'NON',
      savedProgress: '(SI VOUS CLIQUEZ SUR NON, VOTRE PROGRESSION SERA SAUVEGARDÉE)',
    },
    partFour: {
      title: 'PARTIE 04',
      video: 'EMPLACEMENT VIDÉO PARTIE 04',
      observerTitle: 'OBSERVEZ... L’OBSERVATRICE ??',
      observerIntroduction: experiment00PdfCopy.fr.part04,
      watched: 'VIDÉO DÉJÀ VISIONNÉE ?',
      yes: 'OUI',
      no: 'NON',
      observationsTitle: 'OBSERVATIONS',
      observationsIntroduction: 'Répondez aux questions ci-dessous pour voir les résultats.',
      observationQuestions: [
        {
          question: 'PENSEZ-VOUS QU’OBSERVER ZERO A ÉTÉ PLUS JUSTE QU’INEXACTE DANS SES RÉPONSES ?',
          options: ['OUI', 'NON'],
        },
        {
          question: 'PENSEZ-VOUS AVOIR ÉTÉ PLUS JUSTE QU’OBSERVER ZERO ?',
          options: ['OUI', 'NON'],
        },
      ],
      revealTitle: 'PARTIE 04 : RÉSULTATS',
      revealLabel: 'OBSERVER ZERO : RÉPONSES',
      revealVideo: 'EMPLACEMENT VIDÉO RÉPONSES OBSERVER ZERO',
      comparisonQuestion: 'VOS RÉPONSES ÉTAIENT-ELLES PLUS PROCHES QUE CELLES D’OBSERVER ZERO ?',
      endTitle: 'FIN DE LA PARTIE 04',
      endQuestion: 'ÊTES-VOUS PRÊT·E POUR LA PARTIE 05 ?',
      endSavedProgress: '(SI VOUS CLIQUEZ SUR NON, VOTRE PROGRESSION SERA SAUVEGARDÉE)',
    },
    partFive: {
      title: 'PARTIE 05',
      video: 'EMPLACEMENT VIDÉO PARTIE 05',
      observerTitle: experiment00PdfCopy.fr.part05.title,
      observerIntroduction: experiment00PdfCopy.fr.part05.paragraphs,
      connectionQuestion: experiment00PdfCopy.fr.part05.question,
    },
    finalPage: {
      title: 'FIN',
      thankYou: 'MERCI, SUJET',
      identityError: 'IDENTITÉ INDISPONIBLE',
      retry: 'RÉESSAYER',
    },
    introduction: experiment00PdfCopy.fr.introduction,
    explanations: experiment00PdfCopy.fr.explanations,
  },
} as const

type PartNumber = '01' | '02' | '03'

const partStructure = {
  '01': {
    ratingKey: 'part01',
    observationsKey: 'observationsPart01',
    mainStep: 'part-01',
    observationsOneStep: 'observations-01-1',
    observationsTwoStep: 'observations-01-2',
    revealStep: 'reveal-part-01',
    endStep: 'end-part-01',
    nextPart: '02',
  },
  '02': {
    ratingKey: 'part02',
    observationsKey: 'observationsPart02',
    mainStep: 'part-02',
    observationsOneStep: 'observations-02-1',
    observationsTwoStep: 'observations-02-2',
    revealStep: 'reveal-part-02',
    endStep: 'end-part-02',
    nextPart: '03',
  },
  '03': {
    ratingKey: 'part03',
    observationsKey: 'observationsPart03',
    mainStep: 'part-03',
    observationsOneStep: 'observations-03-1',
    observationsTwoStep: 'observations-03-2',
    revealStep: 'reveal-part-03',
    endStep: 'end-part-03',
    nextPart: '04',
  },
} as const

function getPartText(language: Language, partNumber: PartNumber) {
  const base = translations[language].partOne
  if (partNumber === '01') return base

  const placeholder = translations[language].additionalParts[partNumber]
  return {
    ...base,
    title: placeholder.title,
    revealTitle: placeholder.revealTitle,
    observationCopy: placeholder.observationCopy,
    video: placeholder.video,
    annotations: base.annotations.map(annotation => ({
      timestamp: annotation.timestamp,
      content: [placeholder.annotation],
    })),
  }
}

function getObservationsText(language: Language, partNumber: PartNumber) {
  const base = translations[language].observations
  if (partNumber === '01') return base

  const placeholder = translations[language].additionalParts[partNumber]
  return {
    ...base,
    introduction: placeholder.observationsIntroduction,
    connection: placeholder.observationsConnection,
    reason: placeholder.observationsReason,
    chosenSubject: placeholder.chosenSubject,
    otherSubject: partNumber === '03'
      ? translations[language].additionalParts['03'].otherSubject
      : base.otherSubject,
  }
}

function getEndText(language: Language, partNumber: PartNumber): {
  title: string
  question: string
  yes: string
  no: string
  savedProgress: string
} {
  if (partNumber === '01') return translations[language].endPartOne
  if (partNumber === '02') return translations[language].endPartTwo
  return translations[language].endPartThree
}

function readRoute(pathname = window.location.pathname): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  const match = path.match(/^\/experiment\/(\d{2})(?:\/(explanations|welcome|end|part-\d{2}(?:(?:\/observations(?:\/2)?)|\/reveal|\/comparison|\/end)?))?$/)

  if (match) {
    return { kind: 'experiment', series: match[1], part: match[2] ?? null }
  }

  return { kind: 'home' }
}

type TypewriterTextProps = {
  text?: string
  paragraphs?: readonly string[]
  restartOnTextChange?: boolean
  onComplete?: () => void
}

function TypewriterText({
  text,
  paragraphs,
  restartOnTextChange = false,
  onComplete,
}: TypewriterTextProps) {
  const paragraphList = paragraphs ?? (text === undefined ? [] : [text])
  const fullText = paragraphList.join('')
  const previousText = useRef(fullText)
  const onCompleteRef = useRef(onComplete)
  const completionReported = useRef(false)
  const [visibleCharacters, setVisibleCharacters] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Number.POSITIVE_INFINITY : 0,
  )

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setInterval> | undefined
    const textChanged = previousText.current !== fullText
    previousText.current = fullText
    completionReported.current = false

    const finish = () => {
      setVisibleCharacters(fullText.length)
      if (!completionReported.current) {
        completionReported.current = true
        onCompleteRef.current?.()
      }
    }

    if (textChanged && !restartOnTextChange) {
      finish()
      return undefined
    }

    const begin = () => {
      clearInterval(timer)
      completionReported.current = false

      if (reducedMotion.matches) {
        finish()
        return
      }

      const startedAt = performance.now()
      setVisibleCharacters(0)
      timer = setInterval(() => {
        const next = Math.min(fullText.length, Math.floor((performance.now() - startedAt) / 18))
        setVisibleCharacters(next)
        if (next === fullText.length) {
          clearInterval(timer)
          if (!completionReported.current) {
            completionReported.current = true
            onCompleteRef.current?.()
          }
        }
      }, 36)
    }

    const handleMotionChange = () => begin()
    begin()
    reducedMotion.addEventListener('change', handleMotionChange)

    return () => {
      clearInterval(timer)
      reducedMotion.removeEventListener('change', handleMotionChange)
    }
  }, [fullText, restartOnTextChange])

  const visibleCount = Math.min(fullText.length, visibleCharacters)

  if (paragraphs) {
    return (
      <>
        {paragraphs.map((paragraph, index) => {
          const offset = paragraphs.slice(0, index).join('').length
          const paragraphVisibleCount = Math.max(0, Math.min(paragraph.length, visibleCount - offset))

          return (
            <p key={index}>
              <span className="sr-only">{paragraph}</span>
              <span aria-hidden="true">
                {paragraph.slice(0, paragraphVisibleCount)}
                <span className="untyped">{paragraph.slice(paragraphVisibleCount)}</span>
              </span>
            </p>
          )
        })}
      </>
    )
  }

  const singleText = text ?? ''

  return (
    <>
      <span className="sr-only">{singleText}</span>
      <span aria-hidden="true">
        {singleText.slice(0, visibleCount)}
        <span className="untyped">{singleText.slice(visibleCount)}</span>
      </span>
    </>
  )
}

function HomeLink({
  href,
  children,
  className = '',
  onNavigate,
}: {
  href: string
  children: ReactNode
  className?: string
  onNavigate?: () => void
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    onNavigate?.()
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return <a href={href} className={className} onClick={navigate}>{children}</a>
}

const previousStudyRoutes: Record<string, string> = {
  explanations: '/experiment/00',
  welcome: '/experiment/00/explanations',
  'part-01': '/experiment/00/welcome',
  'part-01/observations': '/experiment/00/part-01',
  'part-01/observations/2': '/experiment/00/part-01/observations',
  'part-01/reveal': '/experiment/00/part-01/observations/2',
  'part-01/end': '/experiment/00/part-01/reveal',
  'part-02': '/experiment/00/part-01/end',
  'part-02/observations': '/experiment/00/part-02',
  'part-02/observations/2': '/experiment/00/part-02/observations',
  'part-02/reveal': '/experiment/00/part-02/observations/2',
  'part-02/end': '/experiment/00/part-02/reveal',
  'part-03': '/experiment/00/part-02/end',
  'part-03/observations': '/experiment/00/part-03',
  'part-03/observations/2': '/experiment/00/part-03/observations',
  'part-03/reveal': '/experiment/00/part-03/observations/2',
  'part-03/end': '/experiment/00/part-03/reveal',
  'part-04': '/experiment/00/part-03/end',
  'part-04/observations': '/experiment/00/part-04',
  'part-04/reveal': '/experiment/00/part-04/observations',
  'part-04/comparison': '/experiment/00/part-04/reveal',
  'part-04/end': '/experiment/00/part-04/comparison',
  'part-05': '/experiment/00/part-04/end',
  end: '/experiment/00/part-05',
}

function StudyBackLink({ part }: { part: string | null }) {
  return (
    <HomeLink
      href={part === null ? '/' : (previousStudyRoutes[part] ?? '/experiment/00')}
      className="study-back-link"
    >
      <span aria-hidden="true">←</span>
      <span className="sr-only">Previous study page</span>
    </HomeLink>
  )
}

function InterfaceControls({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: {
  language: Language
  theme: Theme
  onLanguageChange: (language: Language) => void
  onThemeChange: (theme: Theme) => void
}) {
  return (
    <div className="interface-controls">
      <div className="control-group" aria-label="Language">
        <button
          type="button"
          className={`control-option${language === 'en' ? ' is-active' : ''}`}
          aria-pressed={language === 'en'}
          onClick={() => onLanguageChange('en')}
        >
          EN
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          className={`control-option${language === 'fr' ? ' is-active' : ''}`}
          aria-pressed={language === 'fr'}
          onClick={() => onLanguageChange('fr')}
        >
          FR
        </button>
      </div>
      <span className="control-divider" aria-hidden="true">|</span>
      <div className="control-group" aria-label="Theme">
        <button
          type="button"
          className={`control-option${theme === 'white' ? ' is-active' : ''}`}
          aria-pressed={theme === 'white'}
          onClick={() => onThemeChange('white')}
        >
          WHITE
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          className={`control-option${theme === 'black' ? ' is-active' : ''}`}
          aria-pressed={theme === 'black'}
          onClick={() => onThemeChange('black')}
        >
          BLACK
        </button>
      </div>
    </div>
  )
}

function HomePage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: {
  language: Language
  theme: Theme
  onLanguageChange: (language: Language) => void
  onThemeChange: (theme: Theme) => void
}) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const { studyState } = useExperiment00Study()
  const text = translations[language]
  const experiment00Destination = routeForExperiment00Step(studyState?.currentStep)

  return (
    <main className={`home-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <span>SYSTEM</span>
        <span>SELF</span>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="question-block" data-language={language} aria-label="About System Self Art">
        <div className="question-list">
          {questionIds.map(questionId => {
            const question = text.questions[questionId]
            const isOpen = activeQuestion === questionId
            const answerId = `answer-${questionId}`

            return (
              <div className={`question-item${isOpen ? ' is-open' : ''}`} key={questionId}>
                <button
                  type="button"
                  className="question-button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setActiveQuestion(current => current === questionId ? null : questionId)}
                >
                  {question.label}
                </button>
                <div id={answerId} className="answer-space">
                  {isOpen && (
                    <p className="question-answer" aria-live="polite">
                      <TypewriterText text={question.answer} />
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <nav className="experiment-navigation" aria-label="Experiments">
        <HomeLink href={experiment00Destination}>{text.experiment} 00</HomeLink>
        <span aria-hidden="true">|</span>
        <span className="soon" aria-disabled="true">{text.soon}</span>
      </nav>

      <HomeLink href={experiment00Destination} className="start-link">
        {text.start} <span aria-hidden="true">→</span>
      </HomeLink>
    </main>
  )
}

type ExperimentPageProps = ExperimentRoute & {
  language: Language
  theme: Theme
  onLanguageChange: (language: Language) => void
  onThemeChange: (theme: Theme) => void
}

function ExperimentIntroductionPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { setCurrentStep } = useExperiment00Study()
  const text = translations[language]
  const [introductionState, setIntroductionState] = useState<'closed' | 'typing' | 'complete'>('closed')
  const introductionText = text.introduction.join('\n\n')
  const introductionOpen = introductionState !== 'closed'

  return (
    <main className={`experiment-introduction-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <span>SYSTEM</span>
        <span>SELF</span>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className={`experiment-introduction${introductionOpen ? ' is-open' : ''}`}>
        <h2 className="experiment-introduction-title">
          <button
            type="button"
            className="experiment-title-button"
            aria-expanded={introductionOpen}
            aria-controls="experiment-introduction-copy"
            onClick={() => setIntroductionState(current => current === 'closed' ? 'typing' : current)}
          >
            {text.experiment} 00
          </button>
        </h2>

        {introductionOpen && (
          <p id="experiment-introduction-copy" className="introduction-copy" aria-live="polite">
            {introductionState === 'typing' ? (
              <TypewriterText
                text={introductionText}
                restartOnTextChange
                onComplete={() => setIntroductionState('complete')}
              />
            ) : introductionText}
          </p>
        )}
      </section>

      {introductionState === 'complete' && (
        <HomeLink
          href="/experiment/00/explanations"
          className="continue-link"
          onNavigate={() => setCurrentStep('explanations')}
        >
          {text.continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentExplanationsPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { setCurrentStep } = useExperiment00Study()
  const text = translations[language].explanations

  return (
    <main className={`experiment-explanations-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <span>SYSTEM</span>
        <span>SELF</span>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="experiment-explanations">
        <h2 className="experiment-introduction-title">{text.title}</h2>
        <div className="explanations-copy">
          <TypewriterText paragraphs={text.paragraphs} restartOnTextChange />
        </div>
        <HomeLink
          href="/experiment/00/welcome"
          className="continue-link explanations-continue-link"
          onNavigate={() => setCurrentStep('welcome')}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      </section>
    </main>
  )
}

type WelcomeSelectOption = {
  value: string
  label: string
}

function WelcomeSelect({
  id,
  label,
  placeholder,
  value,
  options,
  isOpen,
  onOpenChange,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  options: readonly WelcomeSelectOption[]
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onChange: (value: string) => void
}) {
  const selectRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const keyboardOpeningRef = useRef(false)
  const selectedOption = options.find(option => option.value === value)
  const selectedIndex = options.findIndex(option => option.value === value)
  const listboxId = `${id}-options`

  useLayoutEffect(() => {
    if (!isOpen) return

    if (keyboardOpeningRef.current) {
      optionRefs.current[Math.max(0, selectedIndex)]?.focus({ preventScroll: true })
      keyboardOpeningRef.current = false
    }

    const frameId = window.requestAnimationFrame(() => {
      const select = selectRef.current
      const listbox = listboxRef.current
      if (!select || !listbox) return

      const viewportMargin = 24
      const selectBounds = select.getBoundingClientRect()
      const listboxBounds = listbox.getBoundingClientRect()
      const bottomOverflow = listboxBounds.bottom - (window.innerHeight - viewportMargin)
      if (bottomOverflow <= 0) return

      const availableUpwardMovement = Math.max(0, selectBounds.top - viewportMargin)
      const scrollDistance = Math.min(bottomOverflow, availableUpwardMovement)
      if (scrollDistance <= 0) return

      window.scrollBy({
        top: scrollDistance,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isOpen, selectedIndex])

  function focusOption(index: number) {
    const nextIndex = (index + options.length) % options.length
    optionRefs.current[nextIndex]?.focus()
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusOption(options.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <div ref={selectRef} className={`welcome-select${isOpen ? ' is-open' : ''}`} data-welcome-select>
      <label className="welcome-question-label" htmlFor={id}>{label}</label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`welcome-select-trigger${selectedOption ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onPointerDown={() => { keyboardOpeningRef.current = false }}
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            keyboardOpeningRef.current = true
            if (isOpen) {
              optionRefs.current[Math.max(0, selectedIndex)]?.focus({ preventScroll: true })
              keyboardOpeningRef.current = false
            } else {
              onOpenChange(true)
            }
          } else if (!isOpen && (event.key === 'Enter' || event.key === ' ')) {
            keyboardOpeningRef.current = true
          }
        }}
      >
        {selectedOption?.label ?? placeholder}
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          className="welcome-select-options"
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <button
              ref={element => { optionRefs.current[index] = element }}
              key={option.value}
              type="button"
              className={`welcome-select-option${value === option.value ? ' is-selected' : ''}`}
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value)
                onOpenChange(false)
                triggerRef.current?.focus()
              }}
              onKeyDown={event => handleOptionKeyDown(event, index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ExperimentWelcomePage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const { subjectNumber, isLoading, error, retry } = useExperiment00ParticipantIdentity()
  const text = translations[language].welcome
  const age = studyState?.welcome.age ?? ''
  const country = studyState?.welcome.country ?? ''
  const gender = studyState?.welcome.gender ?? ''
  const ethnicity = studyState?.welcome.ethnicity ?? ''
  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const ages = Array.from({ length: 83 }, (_, index) => {
    const value = String(index + 18)
    return { value, label: value }
  })
  const countryNames = new Intl.DisplayNames([language], { type: 'region' })
  const countries = countryCodes
    .map(code => ({ value: code, label: countryNames.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, language))
  const requiredFieldsComplete = age !== '' && country !== ''

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function updateWelcomeField(field: 'age' | 'country' | 'gender' | 'ethnicity', value: string) {
    updateStudyState(current => ({
      ...current,
      welcome: { ...current.welcome, [field]: value },
    }))
  }

  useEffect(() => {
    if (!openSelect) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest('[data-welcome-select]')) return
      setOpenSelect(null)
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpenSelect(null)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openSelect])

  return (
    <main className={`experiment-welcome-page theme-${theme}${openSelect ? ' has-dropdown-open' : ''}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={nextLanguage => {
          setOpenSelect(null)
          onLanguageChange(nextLanguage)
        }}
        onThemeChange={nextTheme => {
          setOpenSelect(null)
          onThemeChange(nextTheme)
        }}
      />

      <div className="welcome-content">
        <header className="welcome-introduction">
          <h2 className="welcome-title">{text.title}</h2>
          <p className="welcome-subject" aria-live="polite">
            {text.subject}{' '}
            {subjectNumber === null
              ? <span className="subject-number-placeholder">...</span>
              : <span className="subject-number">{subjectNumber}</span>}
          </p>
          {!isLoading && error && (
            <div className="participant-identity-error" role="status">
              <span>{text.identityError}</span>
              <button type="button" onClick={retry}>{text.retry}</button>
            </div>
          )}
          <p className="welcome-copy">{text.introduction}</p>
        </header>

        <form className="welcome-questionnaire" onSubmit={event => event.preventDefault()}>
          <div className={`welcome-question${openSelect === 'age' ? ' is-active' : ''}`}>
            <WelcomeSelect
              id="subject-age"
              label={text.age}
              placeholder={text.agePlaceholder}
              value={age}
              options={ages}
              isOpen={openSelect === 'age'}
              onOpenChange={isOpen => setOpenSelect(isOpen ? 'age' : null)}
              onChange={value => updateWelcomeField('age', value)}
            />
          </div>

          <div className={`welcome-question${openSelect === 'country' ? ' is-active' : ''}`}>
            <WelcomeSelect
              id="subject-country"
              label={text.country}
              placeholder={text.countryPlaceholder}
              value={country}
              options={countries}
              isOpen={openSelect === 'country'}
              onOpenChange={isOpen => setOpenSelect(isOpen ? 'country' : null)}
              onChange={value => updateWelcomeField('country', value)}
            />
          </div>

          <div className={`welcome-question${openSelect === 'gender' ? ' is-active' : ''}`}>
            <WelcomeSelect
              id="subject-gender"
              label={text.gender}
              placeholder={text.genderPlaceholder}
              value={gender}
              options={text.genderOptions}
              isOpen={openSelect === 'gender'}
              onOpenChange={isOpen => setOpenSelect(isOpen ? 'gender' : null)}
              onChange={value => updateWelcomeField('gender', value)}
            />
          </div>

          <div className={`welcome-question${openSelect === 'ethnicity' ? ' is-active' : ''}`}>
            <WelcomeSelect
              id="subject-ethnicity"
              label={text.ethnicity}
              placeholder={text.ethnicityPlaceholder}
              value={ethnicity}
              options={text.ethnicityOptions}
              isOpen={openSelect === 'ethnicity'}
              onOpenChange={isOpen => setOpenSelect(isOpen ? 'ethnicity' : null)}
              onChange={value => updateWelcomeField('ethnicity', value)}
            />
          </div>
        </form>
      </div>

      {requiredFieldsComplete && (
        <HomeLink
          href="/experiment/00/part-01"
          className="continue-link welcome-continue-link"
          onNavigate={() => setCurrentStep('part-01')}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentPartPage({
  partNumber,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'> & { partNumber: PartNumber }) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const text = getPartText(language, partNumber)
  const structure = partStructure[partNumber]
  const [view, setView] = useState<
    'observe' | 'confirm' | 'subject1' | 'subject1Rating' | 'subject2Rating'
  >('observe')
  const ratings = studyState?.[structure.ratingKey]
  const subject1Rating = ratings?.subject1ConnectionRating ?? null
  const subject2Rating = ratings?.subject2ConnectionRating ?? null
  const [activeTimestamp, setActiveTimestamp] = useState<string | null>(null)
  const subject1Open = view === 'subject1Rating' || view === 'subject2Rating'
  const subject2Open = view === 'subject2Rating'
  const ratingsComplete = subject1Rating !== null && subject2Rating !== null
  const ratingValues = Array.from({ length: 10 }, (_, index) => index + 1)
  const activeAnnotation = text.annotations.find(annotation => annotation.timestamp === activeTimestamp)

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function selectRating(subjectIndex: number, rating: number) {
    updateStudyState(current => ({
      ...current,
      [structure.ratingKey]: {
        ...current[structure.ratingKey],
        [subjectIndex === 0 ? 'subject1ConnectionRating' : 'subject2ConnectionRating']: rating,
      },
    }))
  }

  return (
    <main className={`experiment-part-page experiment-main-part-page theme-${theme}${activeAnnotation ? ' has-terminal-open' : ''}`}>
      <h1 className="identity" aria-label="System Self">
        <span>SYSTEM</span>
        <span>SELF</span>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <h2 className="part-title">{text.title}</h2>

      <div className="part-composition">
        <section className="part-media" aria-label={text.video}>
          <div className="video-placeholder">
            {partNumber === '01' ? (
              <iframe
                className="video-embed"
                src="https://www.youtube-nocookie.com/embed/0qYJfb_a1tc?start=21&rel=0"
                title={text.video}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : <span>{text.video}</span>}
          </div>

          <div className="timestamps" aria-label={text.timestamps}>
            <span className="timestamps-label">{text.timestamps}</span>
            {text.annotations.map(annotation => (
              <button
                key={annotation.timestamp}
                type="button"
                className="timestamp-option"
                onClick={() => setActiveTimestamp(annotation.timestamp)}
              >
                {annotation.timestamp}
              </button>
            ))}
          </div>
        </section>

        <section className="observation-introduction" aria-live="polite">
          <div className="part-main-content">
          {view.startsWith('subject') ? (
            <div className="subject-interface">
              <div className="subject-block">
                <button
                  type="button"
                  className="subject-option"
                  aria-expanded={subject1Open}
                  aria-controls="subject-1-rating"
                  onClick={() => {
                    if (view === 'subject1') setView('subject1Rating')
                  }}
                >
                  {text.subjects[0].label}
                </button>

                {subject1Open && (
                  <div id="subject-1-rating" className="subject-rating">
                    <p className="subject-question">{text.subjects[0].question}</p>
                    <div className="rating-options" aria-label={text.subjects[0].question}>
                      {ratingValues.map(rating => (
                        <button
                          key={rating}
                          type="button"
                          className={`rating-option${subject1Rating === rating ? ' is-selected' : ''}`}
                          aria-pressed={subject1Rating === rating}
                          onClick={() => selectRating(0, rating)}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {subject1Rating !== null && (
                <div className="subject-block subject-secondary">
                  <button
                    type="button"
                    className="subject-option"
                    aria-expanded={subject2Open}
                    aria-controls="subject-2-rating"
                    onClick={() => setView('subject2Rating')}
                  >
                    {text.subjects[1].label}
                  </button>

                  {subject2Open && (
                    <div id="subject-2-rating" className="subject-rating">
                      <p className="subject-question">{text.subjects[1].question}</p>
                      <div className="rating-options" aria-label={text.subjects[1].question}>
                        {ratingValues.map(rating => (
                          <button
                            key={rating}
                            type="button"
                            className={`rating-option${subject2Rating === rating ? ' is-selected' : ''}`}
                            aria-pressed={subject2Rating === rating}
                            onClick={() => selectRating(1, rating)}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <h3>{text.observationTitle}</h3>
               <div className="part-observation-copy">
                 {text.observationCopy.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
               </div>
              <button
                type="button"
                className="watched-prompt"
                aria-expanded={view === 'confirm'}
                aria-controls="watched-confirmation"
                onClick={() => setView('confirm')}
              >
                {text.watched}
              </button>

              {view === 'confirm' && (
                <div id="watched-confirmation" className="confirmation-options">
                  <button type="button" className="confirmation-option" onClick={() => setView('subject1')}>
                    {text.yes}
                  </button>
                  <button type="button" className="confirmation-option" onClick={() => undefined}>
                    {text.no}
                  </button>
                </div>
              )}
            </>
          )}
          </div>
          {ratingsComplete && (
            <HomeLink
              href={`/experiment/00/part-${partNumber}/observations`}
              className="continue-link part-continue-link content-relative-continue"
              onNavigate={() => setCurrentStep(structure.observationsOneStep)}
            >
              {translations[language].continue} <span aria-hidden="true">→</span>
            </HomeLink>
          )}
        </section>
      </div>

      {activeAnnotation && (
        <div className="timestamp-terminal-layer" role="presentation">
          <section
            className="timestamp-terminal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="timestamp-terminal-title"
          >
            <button
              type="button"
              className="timestamp-terminal-close"
              aria-label={text.closeTerminal}
              onClick={() => setActiveTimestamp(null)}
              autoFocus
            >
              ×
            </button>

            <div className="timestamp-terminal-scroll">
              <h3 id="timestamp-terminal-title" className="timestamp-terminal-title">
                {activeAnnotation.timestamp}
              </h3>
              <div className="timestamp-terminal-copy">
                {activeAnnotation.content.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function FiveWordInputs({
  id,
  label,
  optionalLabel,
  placeholders,
  words,
  onChange,
}: {
  id: string
  label: string
  optionalLabel: string
  placeholders: readonly string[]
  words: readonly string[]
  onChange: (index: number, value: string) => void
}) {
  const labelId = `${id}-label`

  return (
    <section className="observations-question observations-word-question" aria-labelledby={labelId}>
      <h3 id={labelId} className="observations-question-label">
        {label}
        <span className="observations-optional">{optionalLabel}</span>
      </h3>
      <div className="observations-word-inputs">
        {placeholders.map((placeholder, index) => (
          <input
            key={placeholder}
            className="observations-word-input"
            type="text"
            autoComplete="off"
            aria-label={`${label} ${placeholder}`}
            placeholder={placeholder}
            value={words[index]}
            onChange={event => onChange(index, event.target.value)}
          />
        ))}
      </div>
    </section>
  )
}

function ExperimentObservationsPage({
  partNumber,
  step,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'> & { partNumber: PartNumber; step: 1 | 2 }) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const text = getObservationsText(language, partNumber)
  const structure = partStructure[partNumber]
  const observations = studyState?.[structure.observationsKey]
  const selectedSubject = observations?.moreConfidentSubjectRating ?? ''
  const reason = observations?.reason ?? ''
  const chosenSubjectWords = observations?.chosenSubjectWords ?? ['', '', '', '', '']
  const otherSubjectWords = observations?.otherSubjectWords ?? ['', '', '', '', '']
  const selfWords = observations?.selfWords ?? ['', '', '', '', '']
  const wordQuestionLength = partNumber === '01' ? 5 : 3
  const firstPageComplete = selectedSubject !== ''
  const requiredAnswersComplete = step === 1 ? firstPageComplete : true
  const continueDestination = step === 1
    ? `/experiment/00/part-${partNumber}/observations/2`
    : `/experiment/00/part-${partNumber}/reveal`

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function updateObservations(
    update: (current: NonNullable<typeof observations>) => NonNullable<typeof observations>,
  ) {
    updateStudyState(current => ({
      ...current,
      [structure.observationsKey]: update(current[structure.observationsKey]),
    }))
  }

  function updateWords(
    field: 'chosenSubjectWords' | 'otherSubjectWords' | 'selfWords',
    index: number,
    value: string,
  ) {
    updateObservations(current => ({
      ...current,
      [field]: current[field].map((word, wordIndex) => wordIndex === index ? value : word),
    }))
  }

  return (
    <main className={`experiment-observations-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <div className="observations-content">
        <header className="observations-header">
          <h2 className="observations-title">{text.title}</h2>
          <p className="observations-introduction">{text.introduction}</p>
          <p className="observations-step" aria-label={`${step} / 2`}>{step}/2</p>
        </header>

        <form className="observations-questionnaire" onSubmit={event => event.preventDefault()}>
          {step === 1 ? (
            <>
              <section className="observations-question" aria-labelledby="observations-subject-label">
                <h3
                  id="observations-subject-label"
                  className="observations-question-label observations-response-width"
                >
                  {text.connection}
                </h3>
                <div className="observations-subject-options" role="group" aria-labelledby="observations-subject-label">
                  {text.subjects.map((subject, index) => {
                    const value = index === 0 ? 'subject-1' : 'subject-2'
                    const isSelected = selectedSubject === value

                    return (
                      <button
                        key={value}
                        type="button"
                        className={`observations-subject-option${isSelected ? ' is-selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => updateObservations(current => ({
                          ...current,
                          moreConfidentSubjectRating: value,
                        }))}
                      >
                        {subject}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="observations-question">
                <label className="observations-question-label" htmlFor="observations-reason">
                  {text.reason}
                  <span className="observations-optional">{text.optional}</span>
                </label>
                <textarea
                  id="observations-reason"
                  className="observations-reason observations-response-width"
                  value={reason}
                  onChange={event => updateObservations(current => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                />
              </section>
            </>
          ) : (
            <>
              <FiveWordInputs
                id="chosen-subject-words"
                label={text.chosenSubject}
                optionalLabel={text.wordOptional}
                placeholders={text.words.slice(0, wordQuestionLength)}
                words={chosenSubjectWords.slice(0, wordQuestionLength)}
                onChange={(index, value) => updateWords('chosenSubjectWords', index, value)}
              />

              {partNumber !== '02' && (
                <FiveWordInputs
                  id="other-subject-words"
                  label={text.otherSubject}
                  optionalLabel={text.wordOptional}
                  placeholders={text.words.slice(0, wordQuestionLength)}
                  words={otherSubjectWords.slice(0, wordQuestionLength)}
                  onChange={(index, value) => updateWords('otherSubjectWords', index, value)}
                />
              )}

              {partNumber === '02' && (
                <FiveWordInputs
                  id="self-words"
                  label={translations[language].additionalParts['02'].self}
                  optionalLabel={text.wordOptional}
                  placeholders={text.words.slice(0, wordQuestionLength)}
                  words={selfWords.slice(0, wordQuestionLength)}
                  onChange={(index, value) => updateWords('selfWords', index, value)}
                />
              )}
            </>
          )}
        </form>
      </div>

      {requiredAnswersComplete && (
        <HomeLink
          href={continueDestination}
          className="continue-link observations-continue-link"
          onNavigate={() => setCurrentStep(
            step === 1 ? structure.observationsTwoStep : structure.revealStep,
          )}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentRevealPage({
  partNumber,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'> & { partNumber: PartNumber }) {
  const { ensureStudyState, setCurrentStep } = useExperiment00Study()
  const text = getPartText(language, partNumber)
  const structure = partStructure[partNumber]

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  return (
    <main className={`experiment-part-page experiment-reveal-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <h2 className="part-title">{text.revealTitle}</h2>

      <div className="reveal-composition">
        {[1, 2].map(videoNumber => (
          <section
            key={videoNumber}
            className="part-media reveal-media"
            aria-labelledby={`reveal-subject-${videoNumber}`}
          >
            <h3 id={`reveal-subject-${videoNumber}`} className="reveal-subject-label">
              {text.subjects[videoNumber - 1].label}
            </h3>
            <div className="video-placeholder">
              {partNumber === '01' ? (
                <iframe
                  className="video-embed"
                  src="https://www.youtube-nocookie.com/embed/0qYJfb_a1tc?start=21&rel=0"
                  title={`${text.video} ${videoNumber}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : <span>{text.video}</span>}
            </div>
          </section>
        ))}
      </div>

      <HomeLink
        href={`/experiment/00/part-${partNumber}/end`}
        className="continue-link reveal-continue-link"
        onNavigate={() => setCurrentStep(structure.endStep)}
      >
        {translations[language].continue} <span aria-hidden="true">→</span>
      </HomeLink>
    </main>
  )
}

function ExperimentEndPage({
  partNumber,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'> & { partNumber: PartNumber }) {
  const { ensureStudyState, setCurrentStep } = useExperiment00Study()
  const [ready, setReady] = useState(false)
  const text = getEndText(language, partNumber)
  const structure = partStructure[partNumber]
  const nextPart = structure.nextPart

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  return (
    <main className={`experiment-part-end-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="part-end-content">
        <h2 className="part-end-title">{text.title}</h2>
        {nextPart && (
          <>
            <p className="part-end-question">{text.question}</p>
            <div className="part-end-options">
              <button
                type="button"
                className={`part-end-option${ready ? ' is-selected' : ''}`}
                aria-pressed={ready}
                onClick={() => setReady(true)}
              >
                {text.yes}
              </button>
              <HomeLink
                href="/"
                className="part-end-option"
                onNavigate={() => setCurrentStep(structure.endStep)}
              >
                {text.no}
              </HomeLink>
            </div>
            <p className="part-end-saved-progress">{text.savedProgress}</p>
          </>
        )}
      </section>

      {ready && nextPart && (
        <HomeLink
          href={`/experiment/00/part-${nextPart}`}
          className="continue-link part-end-continue-link"
          onNavigate={() => setCurrentStep(nextPart === '04' ? 'part-04' : partStructure[nextPart].mainStep)}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}

    </main>
  )
}

function ExperimentPartFourPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const text = translations[language].partFour
  const watchedVideo = studyState?.part04.watchedVideo ?? null

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function selectWatchedVideo(answer: 'yes' | 'no') {
    updateStudyState(current => ({
      ...current,
      currentStep: 'part-04',
      part04: { ...current.part04, watchedVideo: answer },
    }))
  }

  return (
    <main className={`experiment-part-page experiment-main-part-page experiment-part-four-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <h2 className="part-title">{text.title}</h2>

      <div className="part-composition part-four-composition">
        <section className="part-media" aria-label={text.video}>
          <div className="video-placeholder">
            <span>{text.video}</span>
          </div>
        </section>

        <section className="observation-introduction part-four-introduction">
          <div className="part-main-content">
          <h3>{text.observerTitle}</h3>
          <div className="part-four-observer-copy">
            {text.observerIntroduction.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <button
            type="button"
            className="watched-prompt part-four-watched-prompt"
            aria-expanded={confirmationOpen}
            aria-controls="part-four-watched-confirmation"
            onClick={() => setConfirmationOpen(true)}
          >
            {text.watched}
          </button>

          {confirmationOpen && (
            <div id="part-four-watched-confirmation" className="confirmation-options">
              {(['yes', 'no'] as const).map(answer => (
                <button
                  key={answer}
                  type="button"
                  className={`confirmation-option${watchedVideo === answer ? ' is-selected' : ''}`}
                  aria-pressed={watchedVideo === answer}
                  onClick={() => selectWatchedVideo(answer)}
                >
                  {text[answer]}
                </button>
              ))}
            </div>
          )}
          </div>

          {watchedVideo === 'yes' && (
            <HomeLink
              href="/experiment/00/part-04/observations"
              className="continue-link part-continue-link content-relative-continue"
              onNavigate={() => setCurrentStep('observations-04')}
            >
              {translations[language].continue} <span aria-hidden="true">→</span>
            </HomeLink>
          )}
        </section>
      </div>
    </main>
  )
}

function ExperimentPartFourObservationsPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const text = translations[language].partFour
  const answers = studyState?.part04.observations
  const values = [answers?.observerAccuracy ?? null, answers?.selfAccuracy ?? null]
  const fields = ['observerAccuracy', 'selfAccuracy'] as const
  const complete = values.every(value => value !== null)

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function selectAnswer(questionIndex: number, optionIndex: number) {
    const field = fields[questionIndex]
    const value = optionIndex === 0 ? 'yes' : 'no'

    updateStudyState(current => ({
      ...current,
      part04: {
        ...current.part04,
        observations: { ...current.part04.observations, [field]: value },
      },
    }))
  }

  return (
    <main className={`experiment-observations-page part-four-observations-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <div className="observations-content">
        <header className="observations-header">
          <h2 className="observations-title">{text.observationsTitle}</h2>
          <p className="observations-introduction">{text.observationsIntroduction}</p>
        </header>

        <form
          className="observations-questionnaire part-four-observations-questionnaire"
          onSubmit={event => event.preventDefault()}
        >
          {text.observationQuestions.map((question, questionIndex) => (
            <section
              key={question.question}
              className="observations-question"
              aria-labelledby={`part-four-question-${questionIndex + 1}`}
            >
              <h3
                id={`part-four-question-${questionIndex + 1}`}
                className="observations-question-label"
              >
                {question.question}
              </h3>
              <div
                className="observations-subject-options part-four-answer-options"
                role="group"
                aria-labelledby={`part-four-question-${questionIndex + 1}`}
              >
                {question.options.map((option, optionIndex) => {
                  const optionValue = optionIndex === 0 ? 'yes' : 'no'
                  const selected = values[questionIndex] === optionValue

                  return (
                    <button
                      key={option}
                      type="button"
                      className={`observations-subject-option${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => selectAnswer(questionIndex, optionIndex)}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </form>
      </div>

      {complete && (
        <HomeLink
          href="/experiment/00/part-04/reveal"
          className="continue-link observations-continue-link"
          onNavigate={() => setCurrentStep('reveal-part-04')}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentPartFourRevealPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { ensureStudyState, setCurrentStep } = useExperiment00Study()
  const text = translations[language].partFour

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  return (
    <main className={`experiment-part-page experiment-reveal-page part-four-reveal-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <h2 className="part-title">{text.revealTitle}</h2>

      <section className="part-media part-four-reveal-media" aria-labelledby="observer-zero-reveal-label">
        <h3 id="observer-zero-reveal-label" className="reveal-subject-label">
          {text.revealLabel}
        </h3>
        <div className="video-placeholder"><span>{text.revealVideo}</span></div>
      </section>

      <HomeLink
        href="/experiment/00/part-04/comparison"
        className="continue-link reveal-continue-link"
        onNavigate={() => setCurrentStep('comparison-part-04')}
      >
        {translations[language].continue} <span aria-hidden="true">→</span>
      </HomeLink>
    </main>
  )
}

function ExperimentPartFourComparisonPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const text = translations[language].partFour
  const comparison = studyState?.part04.comparison ?? null

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function selectComparison(answer: 'yes' | 'no') {
    updateStudyState(current => ({
      ...current,
      part04: { ...current.part04, comparison: answer },
    }))
  }

  return (
    <main className={`part-four-comparison-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="part-four-comparison-content">
        <h2 className="part-four-comparison-question">{text.comparisonQuestion}</h2>
        <div className="part-end-options">
          {(['yes', 'no'] as const).map(answer => (
            <button
              key={answer}
              type="button"
              className={`part-end-option${comparison === answer ? ' is-selected' : ''}`}
              aria-pressed={comparison === answer}
              onClick={() => selectComparison(answer)}
            >
              {text[answer]}
            </button>
          ))}
        </div>
      </section>

      {comparison && (
        <HomeLink
          href="/experiment/00/part-04/end"
          className="continue-link part-four-comparison-continue"
          onNavigate={() => setCurrentStep('end-part-04')}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentPartFourEndPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { ensureStudyState, setCurrentStep } = useExperiment00Study()
  const [ready, setReady] = useState(false)
  const text = translations[language].partFour

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  return (
    <main className={`experiment-part-end-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="part-end-content">
        <h2 className="part-end-title">{text.endTitle}</h2>
        <p className="part-end-question">{text.endQuestion}</p>
        <div className="part-end-options">
          <button
            type="button"
            className={`part-end-option${ready ? ' is-selected' : ''}`}
            aria-pressed={ready}
            onClick={() => setReady(true)}
          >
            {text.yes}
          </button>
          <HomeLink href="/" className="part-end-option" onNavigate={() => setCurrentStep('end-part-04')}>
            {text.no}
          </HomeLink>
        </div>
        <p className="part-end-saved-progress">{text.endSavedProgress}</p>
      </section>

      {ready && (
        <HomeLink
          href="/experiment/00/part-05"
          className="continue-link part-end-continue-link"
          onNavigate={() => setCurrentStep('part-05')}
        >
          {translations[language].continue} <span aria-hidden="true">→</span>
        </HomeLink>
      )}
    </main>
  )
}

function ExperimentPartFivePage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { studyState, ensureStudyState, updateStudyState, setCurrentStep } = useExperiment00Study()
  const text = translations[language].partFive
  const wantsFurtherConnection = studyState?.part05.wantsFurtherConnection ?? null

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  function selectConnectionAnswer(answer: 'yes' | 'no') {
    updateStudyState(current => ({
      ...current,
      currentStep: 'part-05',
      part05: { ...current.part05, wantsFurtherConnection: answer },
    }))
  }

  return (
    <main className={`experiment-part-page experiment-main-part-page experiment-part-five-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <h2 className="part-title">{text.title}</h2>

      <div className="part-composition part-five-composition">
        <section className="part-media" aria-label={text.video}>
          <div className="video-placeholder">
            <span>{text.video}</span>
          </div>
        </section>

        <section className="observation-introduction part-five-introduction">
          <div className="part-main-content">
          <h3>{text.observerTitle}</h3>
          <div className="part-five-observer-copy">
            {text.observerIntroduction.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className="part-five-rating">
            <p id="part-five-connection-question" className="subject-question part-five-question">
              {text.connectionQuestion}
            </p>
            <div className="observations-subject-options" role="group" aria-labelledby="part-five-connection-question">
              {(['yes', 'no'] as const).map((answer, index) => (
                <button
                  key={answer}
                  type="button"
                  className={`observations-subject-option${wantsFurtherConnection === answer ? ' is-selected' : ''}`}
                  aria-pressed={wantsFurtherConnection === answer}
                  onClick={() => selectConnectionAnswer(answer)}
                >
                  {index === 0 ? translations[language].partOne.yes : translations[language].partOne.no}
                </button>
              ))}
            </div>
          </div>
          </div>

          {wantsFurtherConnection !== null && (
            <HomeLink
              href="/experiment/00/end"
              className="continue-link part-continue-link content-relative-continue"
              onNavigate={() => setCurrentStep('end-experiment-00')}
            >
              {translations[language].continue} <span aria-hidden="true">→</span>
            </HomeLink>
          )}
        </section>
      </div>
    </main>
  )
}

function ExperimentFinalPage({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Omit<ExperimentPageProps, 'kind' | 'series' | 'part'>) {
  const { ensureStudyState } = useExperiment00Study()
  const { subjectNumber, isLoading, error, retry } = useExperiment00ParticipantIdentity()
  const text = translations[language].finalPage

  useEffect(() => {
    ensureStudyState()
  }, [ensureStudyState])

  return (
    <main className={`experiment-final-page theme-${theme}`}>
      <h1 className="identity" aria-label="System Self">
        <HomeLink href="/" className="identity-home-link">
          <span>SYSTEM</span>
          <span>SELF</span>
        </HomeLink>
      </h1>

      <InterfaceControls
        language={language}
        theme={theme}
        onLanguageChange={onLanguageChange}
        onThemeChange={onThemeChange}
      />

      <section className="experiment-final-content">
        <h2>{text.title}</h2>
        <p className="final-subject" aria-live="polite">
          {text.thankYou}{' '}
          {subjectNumber === null
            ? <span className="subject-number-placeholder">...</span>
            : <span className="subject-number">{subjectNumber}</span>}
        </p>
        {!isLoading && error && (
          <div className="participant-identity-error" role="status">
            <span>{text.identityError}</span>
            <button type="button" onClick={retry}>{text.retry}</button>
          </div>
        )}
      </section>
    </main>
  )
}

function ExperimentPageContent(props: ExperimentPageProps) {
  const { series, part, language, theme } = props
  const text = translations[language]

  if (series === '00' && part === null) return <ExperimentIntroductionPage {...props} />

  if (series === '00' && part === 'explanations') return <ExperimentExplanationsPage {...props} />

  if (series === '00' && part === 'welcome') return <ExperimentWelcomePage {...props} />

  if (series === '00' && part === 'part-04') return <ExperimentPartFourPage {...props} />

  if (series === '00' && part === 'part-04/observations') {
    return <ExperimentPartFourObservationsPage {...props} />
  }

  if (series === '00' && part === 'part-04/reveal') {
    return <ExperimentPartFourRevealPage {...props} />
  }

  if (series === '00' && part === 'part-04/comparison') {
    return <ExperimentPartFourComparisonPage {...props} />
  }

  if (series === '00' && part === 'part-04/end') {
    return <ExperimentPartFourEndPage {...props} />
  }

  if (series === '00' && part === 'part-05') return <ExperimentPartFivePage {...props} />

  if (series === '00' && part === 'end') return <ExperimentFinalPage {...props} />

  const partRoute = part?.match(/^part-(01|02|03)$/)
  if (series === '00' && partRoute) {
    return <ExperimentPartPage {...props} partNumber={partRoute[1] as PartNumber} />
  }

  const observationsRoute = part?.match(/^part-(01|02|03)\/observations(?:\/(2))?$/)
  if (series === '00' && observationsRoute) {
    return (
      <ExperimentObservationsPage
        {...props}
        partNumber={observationsRoute[1] as PartNumber}
        step={observationsRoute[2] ? 2 : 1}
      />
    )
  }

  const revealRoute = part?.match(/^part-(01|02|03)\/reveal$/)
  if (series === '00' && revealRoute) {
    return <ExperimentRevealPage {...props} partNumber={revealRoute[1] as PartNumber} />
  }

  const endRoute = part?.match(/^part-(01|02|03)\/end$/)
  if (series === '00' && endRoute) {
    return <ExperimentEndPage {...props} partNumber={endRoute[1] as PartNumber} />
  }

  return (
    <main className={`experiment-page theme-${theme}`}>
      <h1>{text.experiment} {series}</h1>
      {part && <p>{part.replace('part-', `${text.part} `).toUpperCase()}</p>}
    </main>
  )
}

function ExperimentPage(props: ExperimentPageProps) {
  const showsParticipantIdentity = props.series === '00'
    && (props.part === 'welcome' || props.part === 'end')

  if (!showsParticipantIdentity) return <ExperimentPageContent {...props} />

  return (
    <Experiment00ParticipantIdentityProvider>
      <ExperimentPageContent {...props} />
    </Experiment00ParticipantIdentityProvider>
  )
}

export default function ArtApp() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<Theme>('white')

  useEffect(() => {
    const handlePopState = () => setRoute(readRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.theme = theme
  }, [language, theme])

  useEffect(() => {
    document.title = route.kind === 'home'
      ? 'SYSTEMSELF.ART'
      : `${translations[language].experiment} ${route.series} — SYSTEMSELF.ART`
  }, [language, route])

  return route.kind === 'home'
    ? (
      <HomePage
        language={language}
        theme={theme}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
      />
    )
    : (
      <>
        <ExperimentPage
          {...route}
          language={language}
          theme={theme}
          onLanguageChange={setLanguage}
          onThemeChange={setTheme}
        />
        {route.series === '00' && <StudyBackLink part={route.part} />}
      </>
    )
}
