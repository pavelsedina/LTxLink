(function () {
  const defaultProtocolHandbooks = {
    "protocol-referral": {
      title: "Kdy odeslat pacienta k posouzení",
      subtitle: "Pomůcka pro rozhodnutí, zda pacienta odeslat do transplantačního centra k posouzení, nebo zatím ne.",
      badges: [
        { label: "ODESÍLACÍ", tone: "neutral" },
        { label: "V1.0", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      intro: "Cílem je odeslat včas a zároveň nepřehlcovat centrum pacienty, kteří zatím indikovaní nejsou. Postup se mírně liší podle věku pacienta.",
      mode: "guide",
      blocks: [
        {
          title: "Varianta A: pacient do 70 let",
          sections: [
            {
              title: "Kdy obecně zvážit odeslání",
              paragraphs: [
                "Odeslání zvažte u pacienta s progredujícím chronickým plicním onemocněním, u kterého je vysoké riziko úmrtí v horizontu nejbližších let i přes optimální léčbu, a u kterého nejsou zjevné překážky transplantace. Lépe odeslat dříve k posouzení než pozdě."
              ]
            },
            {
              title: "Orientační indikace podle diagnózy",
              items: [
                "U plicní fibrózy (zejména IPF) zvažte odeslání při radiologickém nebo histologickém obrazu UIP a současně poklesu plicních funkcí (orientačně FVC pod 80 procent náležité hodnoty nebo difuzní kapacita DLCO pod 40 procent), při jakékoli námahové dušnosti nebo funkčním omezení, nebo při jakékoli potřebě kyslíku.",
                "U CHOPN a emfyzému zvažte odeslání při těžké obstrukci (orientačně FEV1 pod 25 procent náležité hodnoty), při hyperkapnii, hypoxemii, opakovaných těžkých exacerbacích nebo při plicní hypertenzi.",
                "U cystické fibrózy a bronchiektázií zvažte odeslání při poklesu plicních funkcí, opakovaných exacerbacích, hubnutí a zhoršující se výkonnosti.",
                "U plicní hypertenze zvažte odeslání při přetrvávající pokročilé funkční třídě i přes léčbu a při známkách pravostranného srdečního selhávání."
              ]
            },
            {
              title: "Varovné příznaky pro dřívější odeslání",
              items: [
                "Zrychlující se pokles plicních funkcí, nová nebo narůstající potřeba kyslíku, opakované hospitalizace pro respirační zhoršení, výrazný pokles tolerance zátěže, pneumotorax nebo akutní exacerbace."
              ]
            },
            {
              title: "Co přiložit k žádosti",
              items: [
                "Aktuální spirometrii a difuzní kapacitu, popis HRCT hrudníku, výsledek šestiminutového testu chůze, krevní plyny, základní laboratoř, přehled dosavadní léčby a souhrn komorbidit."
              ]
            }
          ]
        },
        {
          title: "Varianta B: pacient nad 70 let",
          sections: [
            {
              title: "Základ je stejný, ale s důrazem na komorbidity a funkční stav",
              paragraphs: [
                "Vyšší věk sám o sobě není absolutní překážkou, ale je významným rizikovým faktorem. U pacienta nad 70 let proto platí stejné orientační indikace jako u varianty A, navíc je ale potřeba pečlivěji zvážit celkový stav, protože systémové komplikace a křehkost mohou transplantaci vyloučit i tehdy, když plicní nález jinak indikaci splňuje."
              ]
            },
            {
              title: "Na co se před odesláním zaměřit",
              items: [
                "Důkladně zhodnoťte přidružená onemocnění, zejména srdce, ledviny a jater, a posuďte, zda nejsou pokročilá. Zhodnoťte funkční stav, soběstačnost a křehkost pacienta, protože zásadně ovlivňují zotavení po výkonu. Zvažte, zda pacient výkon a náročnou pooperační rehabilitaci zvládne."
              ]
            },
            {
              title: "Nižší práh pro to, že pacient zatím není kandidát",
              paragraphs: [
                "U pacienta nad 70 let s významnými komorbiditami nebo výraznou křehkostí je namístě odeslání spíše nezvažovat, dokud nejsou tyto otázky vyjasněné. Pokud si nejste jisti, je vhodné centrum nejprve kontaktovat a konzultovat."
              ]
            },
            {
              title: "Co doložit navíc",
              items: [
                "K podkladům z varianty A přidejte podrobnější kardiologické zhodnocení, přehled renálních a jaterních funkcí a popis funkčního stavu a soběstačnosti."
              ]
            }
          ]
        }
      ]
    },

    "protocol-evaluation": {
      title: "Evaluační protokol LTx",
      subtitle: "Předepsaný postup pracoviště dle ISHLT 2021. Definuje povinnou baterii vyšetření, kterou musí pacient absolvovat před multidisciplinárním konziliem.",
      badges: [
        { label: "EVALUAČNÍ", tone: "neutral" },
        { label: "V3.2", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      mode: "checklist",
      introBlocks: [
        {
          title: "Účel evaluace",
          paragraphs: [
            "Cílem předtransplantačního vyšetření je posoudit, zda je pacient vhodným kandidátem k zařazení na čekací listinu. Vyšetření probíhá zpravidla během jedné hospitalizace, kdy se zkompletují všechna potřebná vyšetření, a poté se pacient představí multidisciplinárnímu týmu."
          ]
        }
      ],
      checklistMeta: "Přehled vyšetření a konzilií - orientační checklist pracoviště (čtení, bez vazby na zadávání dokumentů).",
      groups: [
        {
          title: "FUNKČNÍ VYŠETŘENÍ PLIC",
          items: [
            { title: "Spirometrie (FEV1, FVC, FEV1/FVC)", meta: "vstup: strukturovaný výsledek (čísla)", required: true },
            { title: "Difuzní kapacita (DLCO)", meta: "vstup: strukturovaný výsledek", required: true },
            { title: "Bodypletysmografie", meta: "vstup: strukturovaný výsledek", required: true },
            { title: "Šestiminutový test chůze", meta: "vstup: vzdálenost a saturace", required: true },
            { title: "Krevní plyny", meta: "vstup: PaO2, PaCO2, pH", required: true }
          ]
        },
        {
          title: "ZOBRAZOVACÍ METODY",
          items: [
            { title: "HRCT hrudníku", meta: "vstup: popis a závěr", required: true },
            { title: "Ventilačně-perfuzní sken", meta: "vstup: popis a závěr", required: true }
          ]
        },
        {
          title: "KARDIOLOGICKÉ VYŠETŘENÍ",
          items: [
            { title: "Echokardiografie", meta: "vstup: popis a závěr", required: true },
            { title: "Pravostranná srdeční katetrizace", meta: "podle indikace", required: false },
            { title: "Koronarografie", meta: "podle indikace", required: false }
          ]
        },
        {
          title: "LABORATORNÍ A IMUNOLOGICKÉ VYŠETŘENÍ",
          items: [
            { title: "Krevní obraz a biochemie", meta: "vstup: laboratorní panel", required: true },
            { title: "Renální a jaterní funkce", meta: "vstup: laboratorní panel", required: true },
            { title: "Krevní skupina", meta: "vstup: laboratorní výsledek", required: true },
            { title: "Typizace HLA", meta: "vstup: laboratorní výsledek", required: true },
            { title: "Screening protilátek", meta: "vstup: laboratorní výsledek", required: true }
          ]
        },
        {
          title: "MIKROBIOLOGIE A SÉROLOGIE",
          items: [
            { title: "Kultivace a kolonizace dýchacích cest", meta: "vstup: mikrobiologický nález", required: true },
            { title: "Sérologický status (CMV, EBV, virové hepatitidy, HIV)", meta: "vstup: sérologie", required: true }
          ]
        },
        {
          title: "KONZILIÁRNÍ A DALŠÍ VYŠETŘENÍ",
          items: [
            { title: "Psychologické vyšetření", meta: "vstup: závěr psychologa", required: true },
            { title: "Nutriční hodnocení", meta: "vstup: závěr nutričního týmu", required: true },
            { title: "Fyzioterapeutické hodnocení", meta: "vstup: závěr fyzioterapeuta", required: true },
            { title: "Stomatologické vyšetření", meta: "vstup: závěr", required: true },
            { title: "Denzitometrie", meta: "vstup: popis a závěr", required: true },
            { title: "Onkologický screening podle věku", meta: "vstup: popis a závěr", required: true }
          ]
        }
      ],
      footerBlocks: [
        {
          title: "Orientační překážky a rizikové faktory",
          paragraphs: [
            "Mezi okolnosti, které mohou transplantaci vylučovat nebo výrazně komplikovat, patří aktivní nádorové onemocnění, nekontrolovaná systémová infekce, závažné nevratné postižení jiného orgánu, aktivní závislost (nikotin, alkohol, drogy) a prokázaná neschopnost spolupráce nebo chybějící zázemí. Mezi relativní rizikové faktory patří výrazná nadváha, pokročilý věk v kombinaci s komorbiditami, kolonizace odolnými mikroby, těžká osteoporóza a malnutrice. Posouzení je vždy individuální a v rukou týmu."
          ]
        },
        {
          title: "Rozhodnutí týmu",
          paragraphs: [
            "Po zkompletování vyšetření tým pacienta posoudí a rozhodne, zda ho zařazit na čekací listinu, zda doplnit další vyšetření, nebo zda ho nezařadit. Pokud není zařazen, vrací se do péče odesílajícího pneumologa."
          ]
        }
      ]
    },

    "protocol-followup": {
      title: "Follow-up protokol po BLTx",
      subtitle: "Orientační příručka pro dlouhodobé sledování pacienta po transplantaci plic.",
      badges: [
        { label: "FOLLOW-UP", tone: "neutral" },
        { label: "V2.1", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      mode: "guide",
      blocks: [
        {
          title: "Účel sledování",
          sections: [
            {
              paragraphs: [
                "Po transplantaci je pacient dlouhodobě sledován, aby se včas zachytily komplikace, zejména rejekce, infekce a chronická dysfunkce štěpu. Intenzita sledování je nejvyšší v prvním období po výkonu a postupně se rozvolňuje."
              ]
            }
          ]
        },
        {
          title: "Orientační schéma kontrol",
          sections: [
            {
              paragraphs: [
                "V prvních týdnech až měsících jsou kontroly časté, postupně se prodlužuje interval. Při každé kontrole se hodnotí mimo jiné plicní funkce. Podle protokolu pracoviště se v definovaných intervalech provádí bronchoskopie s vyšetřením a podle indikace i kdykoli při zhoršení."
              ]
            }
          ]
        },
        {
          title: "Imunosupresivní léčba",
          sections: [
            {
              paragraphs: [
                "Pacient užívá kombinaci imunosupresiv, jejichž dávkování se řídí podle hladin a klinického stavu. Součástí je i profylaxe vybraných infekcí. Konkrétní léky, cílové hladiny a profylaktická schémata se řídí protokolem pracoviště a klinickým stavem pacienta."
              ]
            }
          ]
        },
        {
          title: "Sledované komplikace",
          sections: [
            {
              items: [
                "Akutní rejekce, protilátkami zprostředkovaná rejekce, infekční komplikace a chronická dysfunkce plicního štěpu. Sleduje se i vývoj specifických protilátek. Při podezření na zhoršení se doplňují cílená vyšetření."
              ]
            }
          ]
        },
        {
          title: "Sdílená péče",
          sections: [
            {
              paragraphs: [
                "Sledování vede transplantační tým, zejména v prvním období. Postupně se na dlouhodobé péči podílí i ambulantní pneumolog pacienta."
              ]
            }
          ]
        }
      ]
    },

    "protocol-monitoring": {
      title: "Monitorovací protokol",
      subtitle: "Domácí monitoring mezi kontrolami - co pacient sleduje a jak tým reaguje na podněty.",
      badges: [
        { label: "MONITORING", tone: "neutral" },
        { label: "V1.4", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      mode: "guide",
      blocks: [
        {
          title: "Účel monitoringu",
          sections: [
            {
              paragraphs: [
                "Domácí monitoring umožňuje zachytit zhoršení stavu mezi kontrolami. Pacient pravidelně zadává vybrané hodnoty a příznaky, které se přehledně zobrazují týmu a porovnávají s jeho dosavadním vývojem."
              ]
            }
          ]
        },
        {
          title: "Co pacient sleduje",
          sections: [
            {
              items: [
                "Domácí spirometrii (hodnota FEV1), tělesnou hmotnost, krevní tlak, teplotu, saturaci, příznaky, které mohou ukazovat na rejekci nebo infekci, a užití léků."
              ]
            }
          ]
        },
        {
          title: "Referenční hodnota a trendy",
          sections: [
            {
              paragraphs: [
                "Z prvních stabilních poperačních měření se stanoví referenční hodnota plicní funkce, vůči které se sleduje další vývoj. Hodnotí se zejména trend, ne jednotlivé měření."
              ]
            }
          ]
        },
        {
          title: "Orientační podněty k posouzení",
          sections: [
            {
              paragraphs: [
                "Pokles plicní funkce vůči referenční hodnotě, zvýšená teplota, nízká saturace, neužívání léků nebo pacientem nahlášené zhoršení vedou ke vzniku informativního podnětu pro tým. Konkrétní prahy se nastavují podle pracoviště. Všechny podněty jsou informativní a o reakci rozhoduje člověk."
              ]
            }
          ]
        },
        {
          title: "Jak tým reaguje",
          sections: [
            {
              paragraphs: [
                "Podnět se objeví ve frontě, je přiřazen odpovědné osobě a sleduje se jeho vyřešení. Tým podle závažnosti pacienta kontaktuje nebo upraví sledování."
              ]
            }
          ]
        }
      ]
    },

    "protocol-psych": {
      title: "Příručka pro psychologa",
      subtitle: "Role psychologa v předtransplantačním hodnocení, přípravě na čekací listině a podpoře po výkonu.",
      badges: [
        { label: "PSYCHOLOGIE", tone: "neutral" },
        { label: "V1.0", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      mode: "guide",
      blocks: [
        {
          title: "Role psychologa v procesu",
          sections: [
            {
              paragraphs: [
                "Psycholog má roli ve dvou fázích. Při předtransplantačním hodnocení posuzuje psychickou vhodnost kandidáta, a po zařazení na čekací listinu vede přípravu pacienta na transplantaci. Jeho úloha je v celém procesu významná."
              ]
            }
          ]
        },
        {
          title: "Předtransplantační psychologické hodnocení",
          sections: [
            {
              paragraphs: [
                "Cílem je posoudit, zda pacient z psychologického hlediska zvládne transplantaci a náročné období po ní."
              ]
            },
            {
              title: "Hodnotí se zejména",
              items: [
                "Psychický stav a případné poruchy, které by mohly průběh komplikovat.",
                "Motivace pacienta a jeho postoj k celému procesu.",
                "Schopnost spolupráce a dodržování léčebného režimu.",
                "Porozumění tomu, co transplantace obnáší.",
                "Sociální zázemí a podpora okolí."
              ]
            },
            {
              paragraphs: [
                "Výsledkem je hodnocení a závěr, který vstupuje do rozhodování týmu. V současné praxi se toto hodnocení odehrává v nemocničním systému a do platformy se přebírá jako závěr."
              ]
            }
          ]
        },
        {
          title: "Příprava pacienta na čekací listině",
          sections: [
            {
              paragraphs: [
                "Po zařazení na čekací listinu psycholog vede přípravu pacienta, zpravidla formou přípravných seminářů v několika cyklech, kterých se účastní i další členové týmu. Pacient se dozví, jak transplantace vypadá a co ho čeká, a má prostor se na to připravit."
              ]
            }
          ]
        },
        {
          title: "Záznam o přípravě",
          sections: [
            {
              paragraphs: [
                "Pro psychologa je důležitý přehled, kdo z pacientů jednotlivé semináře absolvoval, a poznámky k jejich zapojení a podpoře, například zda pacient přišel sám nebo s doprovodem, jak aktivně se zapojoval, a vlastní komentář. Tento přehled pomáhá sledovat, kdo je na zákrok připraven a kdo potřebuje větší podporu."
              ]
            }
          ]
        },
        {
          title: "Podpora po transplantaci",
          sections: [
            {
              paragraphs: [
                "Po transplantaci může psycholog pacienta dále podporovat. Dlouhodobé sledování psychického stavu pacienta je možným rozšířením do budoucna."
              ]
            }
          ]
        }
      ]
    },

    "protocol-rehab": {
      title: "Příručka pro fyzioterapii",
      subtitle: "Prerehabilitace na čekací listině, křehkost pacienta a rehabilitace po transplantaci.",
      badges: [
        { label: "REHABILITACE", tone: "neutral" },
        { label: "V1.0", tone: "info" },
        { label: "AKTIVNÍ", tone: "ok", icon: "circleCheck" }
      ],
      mode: "guide",
      blocks: [
        {
          title: "Role rehabilitace v procesu",
          sections: [
            {
              paragraphs: [
                "Rehabilitační pracovník / Fyzioterapeut se zaměřuje na fyzickou přípravu pacienta před transplantací a na rehabilitaci po ní. Cílem je, aby pacient do výkonu vstoupil v co nejlepší kondici a po něm se co nejdříve vrátil k funkčnímu stavu. Roli může zastávat lékař i nelékařský odborník."
              ]
            }
          ]
        },
        {
          title: "Prerehabilitace na čekací listině",
          sections: [
            {
              paragraphs: [
                "U pacientů zařazených na čekací listinu probíhá příprava formou prerehabilitace. Pacientovi jsou k dispozici edukační materiály a cvičení, mimo jiné dechová cvičení, ke kterým se může opakovaně vracet."
              ]
            }
          ]
        },
        {
          title: "Křehkost pacienta",
          sections: [
            {
              paragraphs: [
                "Důležitým hlediskem je míra křehkosti pacienta. Křehký pacient s oslabenou kondicí a sníženou svalovou hmotou není z transplantace vyloučen, ale vyžaduje opatrnější přístup, protože návrat do funkčního stavu po výkonu je u něj výrazně náročnější a delší. Proto je užitečné mít přehled, kteří pacienti do této ohrožené skupiny patří, a věnovat jim zvýšenou pozornost už v přípravě. Konkrétní způsob hodnocení křehkosti se řídí praxí pracoviště."
              ]
            }
          ]
        },
        {
          title: "Rehabilitace po transplantaci",
          sections: [
            {
              paragraphs: [
                "Po transplantaci je rehabilitace velmi důležitá. Zahrnuje mimo jiné dechovou rehabilitaci, práci s dechovými pomůckami a nácvik správného odkašlávání. I zde jsou pacientovi k dispozici edukační materiály a videa, ke kterým se může vracet."
              ]
            }
          ]
        },
        {
          title: "Sledování ohrožených pacientů",
          sections: [
            {
              paragraphs: [
                "Užitečný je přehled pacientů, kterým je třeba se v přípravě i po výkonu více věnovat, zejména těch křehkých. Jaké konkrétní ukazatele fyzické kondice a aktivity má smysl sledovat, je vhodné doladit s rehabilitačním týmem."
              ]
            }
          ]
        }
      ]
    }
  };

  const defaultHandbookCatalogByRole = {
    ambulatory: [
      { id: "protocol-referral", label: "Protokol odeslání", icon: "pathway" }
    ],
    coordinator: [
      { id: "protocol-evaluation", label: "Evaluační protokol", icon: "documents" },
      { id: "protocol-followup", label: "Follow-up protokol po BLTx", icon: "documents" },
      { id: "protocol-monitoring", label: "Monitorovací protokol", icon: "documents" }
    ],
    txPulmo: [
      { id: "protocol-evaluation", label: "Evaluační protokol", icon: "documents" },
      { id: "protocol-followup", label: "Follow-up protokol po BLTx", icon: "documents" },
      { id: "protocol-monitoring", label: "Monitorovací protokol", icon: "documents" }
    ],
    surgeon: [
      { id: "protocol-evaluation", label: "Evaluační protokol", icon: "documents" },
      { id: "protocol-followup", label: "Follow-up protokol po BLTx", icon: "documents" },
      { id: "protocol-monitoring", label: "Monitorovací protokol", icon: "documents" }
    ],
    intensivist: [
      { id: "protocol-evaluation", label: "Evaluační protokol", icon: "documents" },
      { id: "protocol-followup", label: "Follow-up protokol po BLTx", icon: "documents" },
      { id: "protocol-monitoring", label: "Monitorovací protokol", icon: "documents" }
    ],
    psychologist: [
      { id: "protocol-psych", label: "Příručka pro psychologa", icon: "documents" }
    ],
    rehab: [
      { id: "protocol-rehab", label: "Příručka pro fyzio", icon: "documents" }
    ]
  };

  let protocolHandbooks = defaultProtocolHandbooks;
  let handbookCatalogByRole = defaultHandbookCatalogByRole;

  function initFromState(handbooks, catalog) {
    if (handbooks && Object.keys(handbooks).length) {
      protocolHandbooks = { ...defaultProtocolHandbooks, ...handbooks };
    }
    if (catalog && Object.keys(catalog).length) {
      handbookCatalogByRole = { ...defaultHandbookCatalogByRole, ...catalog };
    }
  }

  function updateHandbook(handbookId, data) {
    protocolHandbooks = {
      ...protocolHandbooks,
      [handbookId]: { ...(protocolHandbooks[handbookId] || {}), ...data }
    };
  }

  function getHandbooksState() {
    return protocolHandbooks;
  }

  function getCatalogState() {
    return handbookCatalogByRole;
  }

  function listHandbookIds() {
    return Object.keys(protocolHandbooks);
  }

  function hasHandbooksForRole(roleId) {
    return (handbookCatalogByRole[roleId] || []).length > 0;
  }

  function getHandbooksForRole(roleId) {
    return (handbookCatalogByRole[roleId] || []).map((entry) => {
      const handbook = protocolHandbooks[entry.id];
      return {
        ...entry,
        title: handbook?.title || entry.label,
        subtitle: handbook?.subtitle || "",
        badge: handbook?.badges?.find((item) => item.tone === "ok")?.label
          || handbook?.badges?.[0]?.label
          || ""
      };
    });
  }

  function canAccessHandbook(handbookId, roleId) {
    return getHandbooksForRole(roleId).some((item) => item.id === handbookId);
  }

  function getProtocolHandbook(protocolId) {
    return protocolHandbooks[protocolId] || null;
  }

  function countChecklistItems(groups) {
    const items = (groups || []).flatMap((group) => group.items || []);
    const required = items.filter((item) => item.required).length;
    return { total: items.length, required };
  }

  window.ProtocolHandbooks = {
    initFromState,
    updateHandbook,
    getHandbooksState,
    getCatalogState,
    listHandbookIds,
    hasHandbooksForRole,
    getHandbooksForRole,
    canAccessHandbook,
    getProtocolHandbook,
    renderProtocolWorkspace,
    renderHandbooksWorkspace
  };

  function renderMonoIconSafe(id) {
    const stroke = "currentColor";
    const common = `class="mono-icon protocol-check-icon" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    const icons = {
      documents: `<svg ${common}><path d="M8 4h7l3 3v13H8z"/><path d="M15 4v4h4M11 12h5M11 16h5"/></svg>`,
      pathway: `<svg ${common}><path d="M4 7h16M4 12h10M4 17h6"/><circle cx="18" cy="12" r="2"/><circle cx="14" cy="17" r="2"/></svg>`,
      check: `<svg ${common}><path d="M20 6 9 17l-5-5"/></svg>`,
      circleCheck: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="m9 12 2.5 2.5L16 10"/></svg>`
    };
    return icons[id] || icons.documents;
  }

  function renderProtocolBadge(badge) {
    const icon = badge.icon ? `<span class="protocol-badge-icon" aria-hidden="true">${renderMonoIconSafe(badge.icon)}</span>` : "";
    return `<span class="pill protocol-badge protocol-badge--${badge.tone || "neutral"}">${icon}${escapeProtocolHtml(badge.label)}</span>`;
  }

  function escapeProtocolHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderProtocolParagraphs(paragraphs) {
    return (paragraphs || []).map((paragraph) => `<p>${escapeProtocolHtml(paragraph)}</p>`).join("");
  }

  function renderProtocolItems(items) {
    if (!items?.length) return "";
    if (items.length === 1 && items[0].length > 120) {
      return `<p>${escapeProtocolHtml(items[0])}</p>`;
    }
    return `
      <ul class="protocol-bullet-list">
        ${items.map((item) => `<li>${escapeProtocolHtml(item)}</li>`).join("")}
      </ul>
    `;
  }

  function renderProtocolGuideSection(section) {
    return `
      <div class="protocol-guide-section">
        ${section.title ? `<h4>${escapeProtocolHtml(section.title)}</h4>` : ""}
        ${renderProtocolParagraphs(section.paragraphs)}
        ${renderProtocolItems(section.items)}
      </div>
    `;
  }

  function renderProtocolGuideBlock(block) {
    return `
      <section class="protocol-guide-block">
        <h3 class="protocol-guide-block-title">${escapeProtocolHtml(block.title)}</h3>
        ${(block.sections || []).map(renderProtocolGuideSection).join("")}
      </section>
    `;
  }

  function renderProtocolChecklistItem(item) {
    return `
      <div class="protocol-check-item">
        <span class="protocol-check-box" aria-hidden="true">${renderMonoIconSafe("check")}</span>
        <div class="protocol-check-body">
          <strong>${escapeProtocolHtml(item.title)}</strong>
          ${item.meta ? `<span class="protocol-check-meta">${escapeProtocolHtml(item.meta)}</span>` : ""}
        </div>
        <span class="pill protocol-check-pill ${item.required ? "protocol-check-pill--required" : "protocol-check-pill--optional"}">
          ${item.required ? "POVINNÉ" : "VOLITELNÉ"}
        </span>
      </div>
    `;
  }

  function renderProtocolChecklistGroups(groups, metaText) {
    const stats = countChecklistItems(groups);
    return `
      <section class="card protocol-checklist-card">
        <div class="protocol-checklist-head">
          <div>
            <h3>Položky protokolu (${stats.total})</h3>
            <p class="protocol-checklist-meta">${escapeProtocolHtml(metaText || "")}</p>
          </div>
          <p class="protocol-checklist-stats">Povinných: ${stats.required} • čtení (role bez práva editace)</p>
        </div>
        ${(groups || []).map((group) => `
          <div class="protocol-check-group">
            <p class="protocol-check-group-title">${escapeProtocolHtml(group.title)}</p>
            <div class="protocol-check-list">
              ${(group.items || []).map(renderProtocolChecklistItem).join("")}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }

  function renderProtocolHeader(handbook) {
    return `
      <section class="card protocol-header-card">
        <div class="protocol-header-main">
          <span class="protocol-header-icon" aria-hidden="true">${renderMonoIconSafe("documents")}</span>
          <div class="protocol-header-copy">
            <div class="protocol-header-title-row">
              <h2>${escapeProtocolHtml(handbook.title)}</h2>
              <div class="protocol-header-badges">
                ${(handbook.badges || []).map(renderProtocolBadge).join("")}
              </div>
            </div>
            <p class="protocol-header-sub">${escapeProtocolHtml(handbook.subtitle)}</p>
            ${handbook.intro ? `<p class="protocol-header-intro">${escapeProtocolHtml(handbook.intro)}</p>` : ""}
          </div>
        </div>
      </section>
    `;
  }

  function renderProtocolWorkspace(protocolId) {
    const handbook = getProtocolHandbook(protocolId);
    if (!handbook) {
      return `<div class="card"><div class="empty">Protokol nebyl nalezen.</div></div>`;
    }

    if (handbook.mode === "checklist") {
      const intro = (handbook.introBlocks || []).map((block) => `
        <section class="card protocol-guide-block">
          ${block.title ? `<h3 class="protocol-guide-block-title">${escapeProtocolHtml(block.title)}</h3>` : ""}
          ${renderProtocolParagraphs(block.paragraphs)}
        </section>
      `).join("");

      const footer = (handbook.footerBlocks || []).map((block) => `
        <section class="card protocol-guide-block">
          <h3 class="protocol-guide-block-title">${escapeProtocolHtml(block.title)}</h3>
          ${renderProtocolParagraphs(block.paragraphs)}
        </section>
      `).join("");

      return `
        <div class="grid protocol-workspace">
          ${renderProtocolHeader(handbook)}
          ${intro}
          ${renderProtocolChecklistGroups(handbook.groups, handbook.checklistMeta)}
          ${footer}
        </div>
      `;
    }

    return `
      <div class="grid protocol-workspace">
        ${renderProtocolHeader(handbook)}
        <section class="card protocol-guide-card">
          ${(handbook.blocks || []).map(renderProtocolGuideBlock).join("")}
        </section>
      </div>
    `;
  }

  function renderHandbooksIndex(roleId) {
    const items = getHandbooksForRole(roleId);

    return `
      <div class="grid handbook-index-wrap">
        <section class="card handbook-index-card">
          <h2 class="handbook-index-title">Příručky</h2>
          <p class="handbook-index-sub">
            Odborné postupy, doporučení a informační materiály pro podporu klinického rozhodování a koordinaci péče.
          </p>
        </section>
        <div class="handbook-tile-grid">
          ${items.map((item) => `
            <button type="button" class="handbook-tile" data-open-handbook="${escapeProtocolHtml(item.id)}">
              <span class="handbook-tile-icon" aria-hidden="true">${renderMonoIconSafe(item.icon)}</span>
              <span class="handbook-tile-body">
                <strong>${escapeProtocolHtml(item.label)}</strong>
                <span>${escapeProtocolHtml(item.subtitle)}</span>
              </span>
              ${item.badge ? `<span class="pill handbook-tile-badge">${escapeProtocolHtml(item.badge)}</span>` : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderHandbooksWorkspace(roleId, handbookId) {
    if (handbookId && canAccessHandbook(handbookId, roleId)) {
      return `
        <div class="handbook-detail-wrap">
          <div class="handbook-detail-toolbar">
            <button type="button" class="btn ghost btn-compact" data-handbooks-back>← Příručky</button>
          </div>
          ${renderProtocolWorkspace(handbookId)}
        </div>
      `;
    }

    return renderHandbooksIndex(roleId);
  }
})();
