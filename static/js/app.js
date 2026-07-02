
    let stateBootstrapped = false;
    let stateSyncTimer = null;
    let isAuthenticated = false;

    const LTXLINK_LOGO = "/static/img/ltxlink-logo.png";
    const LTXLINK_SIDEBAR_LOGO = "/static/img/ltxlink-logo-sidebar.png";

    function showLoginScreen() {
      isAuthenticated = false;
      const loginScreen = document.getElementById("loginScreen");
      const appShell = document.getElementById("appShell");
      if (loginScreen) loginScreen.hidden = false;
      if (appShell) appShell.hidden = true;
    }

    function hideLoginScreen() {
      isAuthenticated = true;
      const loginScreen = document.getElementById("loginScreen");
      const appShell = document.getElementById("appShell");
      if (loginScreen) loginScreen.hidden = true;
      if (appShell) appShell.hidden = false;
    }

    function handleLoginSubmit(event) {
      event.preventDefault();
      hideLoginScreen();
      if (!stateBootstrapped) {
        bootstrapFromServer();
      } else {
        render();
      }
    }

    function wireLoginOnce() {
      if (wireLoginOnce.done) return;
      wireLoginOnce.done = true;
      document.getElementById("loginForm")?.addEventListener("submit", handleLoginSubmit);
      wireModalScrollLockOnce();
    }

    function syncDrawerBodyOverflow(section) {
      if (!section) return;
      const needsScroll = section.scrollHeight > section.clientHeight + 1;
      section.classList.toggle("is-scrollable", needsScroll);
    }

    function syncAllDrawerBodyOverflow() {
      const sync = () => {
        document.querySelectorAll(".patient-edit-body").forEach((section) => {
          syncDrawerBodyOverflow(section);
        });
      };
      sync();
      requestAnimationFrame(sync);
    }

    function syncPageScrollLock() {
      const anyModalOpen = Boolean(document.querySelector(".modal-backdrop.open"));
      document.documentElement.classList.toggle("modal-scroll-locked", anyModalOpen);
      document.body.classList.toggle("modal-scroll-locked", anyModalOpen);

      if (anyModalOpen) {
        requestAnimationFrame(() => {
          syncAllDrawerBodyOverflow();
        });
      }
    }

    function wireModalScrollLockOnce() {
      if (wireModalScrollLockOnce.done) return;
      wireModalScrollLockOnce.done = true;

      document.querySelectorAll(".modal-backdrop").forEach((modal) => {
        new MutationObserver(() => {
          syncPageScrollLock();
        }).observe(modal, { attributes: true, attributeFilter: ["class"] });
      });

      document.addEventListener("wheel", (event) => {
        if (!document.querySelector(".modal-backdrop.open")) return;

        const scrollEl = getModalScrollElement(event.target);
        if (scrollEl && canModalScrollElement(scrollEl, event.deltaY)) {
          return;
        }

        event.preventDefault();
      }, { passive: false, capture: true });
    }

    function canModalScrollElement(el, deltaY) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 1) return false;
      if (deltaY < 0 && scrollTop > 0) return true;
      if (deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1) return true;
      return false;
    }

    function getModalScrollElement(target) {
      const selectors = [
        ".patient-edit-body.is-scrollable",
        "#demoRoleModal [data-modal-scroll]",
        "#personalNotesModal textarea",
        "[data-modal-scroll]"
      ];

      for (const selector of selectors) {
        const el = target.closest(selector);
        if (el) return el;
      }

      return null;
    }

    function positionAnchoredModal(modalId, panelSelector, anchor) {
      const modal = document.getElementById(modalId);
      const panel = modal?.querySelector(panelSelector);
      if (!modal || !panel || !modal.classList.contains("open") || !anchor) return;

      const pad = 12;
      const gap = anchor.gap ?? 8;
      let left = anchor.x + (anchor.offsetX ?? 0);
      let top = anchor.y + gap + (anchor.offsetY ?? 0);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;

      requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        left = Math.min(Math.max(pad, left), window.innerWidth - rect.width - pad);
        top = Math.min(Math.max(pad, top), window.innerHeight - rect.height - pad);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      });
    }

    function getDemoRoleAnchorFallback() {
      const photo = document.getElementById("viewUserPhoto");
      if (!photo) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }

      const rect = photo.getBoundingClientRect();
      return { x: rect.left, y: rect.bottom + 8 };
    }

    function positionDemoRoleModal() {
      const anchor = demoState.demoRoleAnchor || getDemoRoleAnchorFallback();
      positionAnchoredModal("demoRoleModal", ".demo-role-modal", {
        x: anchor.x,
        y: anchor.y,
        offsetX: 6,
        offsetY: 6
      });
    }

    function getPersonalNotesAnchor() {
      const btn = document.getElementById("openPersonalNotesBtn");
      if (!btn) {
        return { x: 24, y: 72 };
      }

      const rect = btn.getBoundingClientRect();
      return { x: rect.left, y: rect.bottom };
    }

    function positionPersonalNotesModal() {
      const anchor = getPersonalNotesAnchor();
      positionAnchoredModal("personalNotesModal", ".personal-notes-modal", {
        x: anchor.x,
        y: anchor.y,
        gap: 8
      });
    }

    function migrateChatReadStateToRoles() {
      ["internalChatRead", "referralChatRead"].forEach((storeKey) => {
        const store = demoState[storeKey];
        if (!store) return;
        demoUsers.forEach((user) => {
          if (!store[user.id]) return;
          if (!store[user.roleId]) store[user.roleId] = { ...store[user.id] };
          else store[user.roleId] = { ...store[user.id], ...store[user.roleId] };
          delete store[user.id];
        });
      });
    }

    function getDocumentVisibility(file) {
      if (!file) return "internal";
      if (file.visibility === "shared_ambulatory" || file.visibility === "internal") {
        return file.visibility;
      }
      return file.shareAmbulatory ? "shared_ambulatory" : "internal";
    }

    function applyDocumentVisibility(file, visibility) {
      if (!file) return file;
      file.visibility = visibility;
      file.shareAmbulatory = visibility === "shared_ambulatory";
      file.sharePatient = false;
      return file;
    }

    function getDocumentRole(file) {
      if (!file) return "supporting";
      if (file.docRole === "outbound_message" || file.docRole === "supporting") {
        return file.docRole;
      }
      return getDocumentVisibility(file) === "shared_ambulatory" ? "outbound_message" : "supporting";
    }

    function applyDocumentRole(file, docRole) {
      if (!file) return file;
      file.docRole = docRole;
      return applyDocumentVisibility(
        file,
        docRole === "outbound_message" ? "shared_ambulatory" : "internal"
      );
    }

    function normalizeDocumentVisibility(file) {
      if (!file) return file;
      const normalized = applyDocumentVisibility(file, getDocumentVisibility(file));
      if (!normalized.docRole) {
        normalized.docRole = getDocumentRole(normalized);
      }
      return normalized;
    }

    function migrateDocumentVisibility() {
      patients.forEach((patient) => {
        Object.values(patient.flowEvidence || {}).forEach((items) => {
          (items || []).forEach((item) => {
            if (isFlowEvidenceSubmission(item)) {
              item.files = (item.files || []).map(normalizeDocumentVisibility);
            } else {
              normalizeDocumentVisibility(item);
            }
          });
        });
        if (!patient.referralNotifications) patient.referralNotifications = [];
      });
      migrateFlowEvidenceToSubmissions();
    }

    function isFlowEvidenceSubmission(item) {
      return Boolean(item && Array.isArray(item.files));
    }

    function migrateFlowEvidenceToSubmissions() {
      patients.forEach((patient) => {
        Object.keys(patient.flowEvidence || {}).forEach((bucket) => {
          const items = patient.flowEvidence[bucket] || [];
          if (!items.length || items.every(isFlowEvidenceSubmission)) return;

          const groups = new Map();
          items.forEach((file) => {
            if (isFlowEvidenceSubmission(file)) return;
            normalizeDocumentVisibility(file);
            const role = getDocumentRole(file);
            const groupKey = [
              file.date || "",
              role,
              file.examId || "",
              file.outputNote || "",
              file.authorId || ""
            ].join("|");
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey).push(file);
          });

          const submissions = items.filter(isFlowEvidenceSubmission);
          groups.forEach((files) => {
            const first = files[0];
            const role = getDocumentRole(first);
            submissions.push({
              id: `${patient.id}-sub-${first.id}`,
              authorId: first.authorId || "u-coord",
              author: first.author || "Tým centra",
              createdAt: first.createdAt || (first.date ? `${first.date} 10:00` : formatDemoTimestamp()),
              note: first.outputNote
                || (first.examTitle ? `Výstup vyšetření: ${first.examTitle}` : "")
                || (files.length > 1 ? "Podklady k fázi" : first.name),
              docRole: role,
              examId: first.examId || null,
              examTitle: first.examTitle || null,
              files: files.map((file) => ({
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                date: file.date
              }))
            });
          });

          patient.flowEvidence[bucket] = submissions;
        });
      });
    }

    function getPhaseEvidenceSubmissions(patient, bucket) {
      return (patient.flowEvidence?.[bucket] || []).filter(isFlowEvidenceSubmission);
    }

    function flattenSubmissionFiles(submission) {
      return (submission.files || []).map((file) => applyDocumentRole({
        ...file,
        submissionId: submission.id,
        author: submission.author,
        authorId: submission.authorId,
        createdAt: submission.createdAt,
        date: file.date || submission.createdAt,
        examId: submission.examId || file.examId || null,
        examTitle: submission.examTitle || file.examTitle || null,
        outputNote: submission.note || file.outputNote || null
      }, submission.docRole));
    }

    function filterSubmissionsForViewer(submissions) {
      const user = activeUser();
      if (user.roleId === "ambulatory") {
        return (submissions || []).filter((item) => item.docRole === "outbound_message");
      }
      if (user.roleId === "patient") return [];
      return [...(submissions || [])];
    }

    function dedupeSubmissionsById(submissions) {
      const seen = new Set();
      return (submissions || []).filter((item) => {
        const key = item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getMergedPhaseEvidenceSubmissions(patient, buckets, { viewerScoped = true } = {}) {
      const merged = buckets.flatMap((bucket) => getPhaseEvidenceSubmissions(patient, bucket));
      const scoped = viewerScoped ? filterSubmissionsForViewer(merged) : merged;
      return dedupeSubmissionsById(scoped);
    }

    function pushPhaseEvidenceSubmission(patient, bucket, submission) {
      if (!patient.flowEvidence) patient.flowEvidence = {};
      if (!patient.flowEvidence[bucket]) patient.flowEvidence[bucket] = [];
      patient.flowEvidence[bucket].unshift(submission);
    }

    function createPhaseEvidenceSubmission({
      patient,
      bucket,
      docRole,
      note,
      files,
      user,
      now,
      examId = null,
      examTitle = null
    }) {
      const dateShort = now.split(/\s+/).slice(0, 2).join(" ");
      const submission = {
        id: `${patient.id}-sub-${Date.now()}`,
        authorId: user.id,
        author: user.name,
        createdAt: now,
        note: note || "",
        docRole,
        examId,
        examTitle,
        files: files.map((file, index) => ({
          id: file.id || `${patient.id}-flow-${Date.now()}-${index}`,
          name: file.name,
          type: file.type,
          size: file.size === "-" ? "142 kB" : file.size,
          date: dateShort
        }))
      };
      pushPhaseEvidenceSubmission(patient, bucket, submission);
      return submission;
    }

    function getPhaseEvidenceBucketForStep(stepKey, patient) {
      if (stepKey === "posuzování") return "rozhodnutí";
      if (stepKey === "wl") return "rozhodnutí";
      if (stepKey === "po_tx") return "po_tx";
      if (stepKey === "ukonceno") return "ukonceno";
      return getInPhaseEvidenceBucket(patient);
    }

    function getInPhaseEvidenceBucket(patient) {
      if (patient.state === "POSUZOVANI") return "rozhodnutí";
      if (patient.state === "WL") return "rozhodnutí";
      return "rozhodnutí";
    }

    function getPhaseEvidenceUploadBucket(patient, docRole) {
      if (patient.state === "WL" && docRole === "outbound_message") return "po_tx";
      if (patient.state === "POSUZOVANI") return "rozhodnutí";
      if (patient.state === "WL") return "rozhodnutí";
      return "rozhodnutí";
    }

    function getPhaseEvidenceFiles(patient, bucket) {
      return dedupeAttachmentsById(
        getPhaseEvidenceSubmissions(patient, bucket).flatMap(flattenSubmissionFiles)
      );
    }

    function findOutboundMessageSubmission(patient, bucket) {
      return getPhaseEvidenceSubmissions(patient, bucket).find(
        (item) => item.docRole === "outbound_message"
      );
    }

    function findOutboundMessageDoc(patient, bucket) {
      const submission = findOutboundMessageSubmission(patient, bucket);
      return submission?.files?.[0] ? flattenSubmissionFiles(submission)[0] : null;
    }

    function canAddPhaseEvidence(patient) {
      return canManageFlowEvidence() && ["POSUZOVANI", "WL"].includes(patient?.state);
    }

    function canCreateOutboundPhaseMessage() {
      const roleId = activeUser().roleId;
      return roleId === "coordinator" || isClinicalTeamViewer();
    }

    function renderFlowDocumentRoleBadges(file) {
      return renderFlowDocumentSharingIcon(file);
    }

    function renderFlowDocumentSharingIcon(file) {
      if (!isInternalViewer()) return "";
      if (getDocumentRole(file) === "outbound_message") {
        return `
          <span
            class="flow-doc-access flow-doc-access--outbound"
            title="Sdíleno s odesílajícím pneumologem - zpráva odejde při uzavření fáze"
            aria-label="Sdíleno s odesílajícím pneumologem"
          >${renderMonoIcon("participants", "mono-icon flow-doc-access-icon")}</span>
        `;
      }
      return `
        <span
          class="flow-doc-access flow-doc-access--internal"
          title="Interní podklad - vidí jen tým centra"
          aria-label="Interní podklad"
        >${renderMonoIcon("lock", "mono-icon flow-doc-access-icon")}</span>
      `;
    }

    function renderSectionTitleWithHint(title, hint = "") {
      if (!hint) {
        return `<h3 class="medication-card-title">${escapeHtml(title)}</h3>`;
      }
      return `
        <h3 class="medication-card-title medication-card-title--with-hint">
          ${escapeHtml(title)}
          <span
            class="card-title-hint"
            tabindex="0"
            role="img"
            aria-label="${escapeHtml(hint)}"
            title="${escapeHtml(hint)}"
          >${renderMonoIcon("info", "mono-icon card-title-hint-icon")}</span>
        </h3>
      `;
    }

    const DAILY_RECORDS_PAGE_SIZE = 10;

    function getDailyRecordsPage(records) {
      const totalPages = Math.max(1, Math.ceil(records.length / DAILY_RECORDS_PAGE_SIZE));
      const page = demoState.dailyRecordsPage || 0;
      return Math.min(Math.max(page, 0), totalPages - 1);
    }

    function renderDailyRecordsPagination(patientId, records) {
      const totalPages = Math.max(1, Math.ceil(records.length / DAILY_RECORDS_PAGE_SIZE));
      const page = getDailyRecordsPage(records);
      if (totalPages <= 1) return "";

      return `
        <div class="list-pagination">
          <button
            type="button"
            class="btn ghost btn-compact"
            data-daily-records-page="${patientId}"
            data-page="${page - 1}"
            ${page <= 0 ? "disabled" : ""}
          >Předchozí</button>
          <span class="list-pagination-meta">${page + 1} / ${totalPages}</span>
          <button
            type="button"
            class="btn ghost btn-compact"
            data-daily-records-page="${patientId}"
            data-page="${page + 1}"
            ${page >= totalPages - 1 ? "disabled" : ""}
          >Další</button>
        </div>
      `;
    }

    function scheduleStateSync() {
      if (!stateBootstrapped) return;
      if (stateSyncTimer) window.clearTimeout(stateSyncTimer);
      stateSyncTimer = window.setTimeout(async () => {
        try {
          await fetch("/api/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              demoState,
              patients,
              organOffers,
              referringNetwork,
              ...(window.LtxAdmin?.getExportState?.() || {})
            })
          });
        } catch (error) {
          console.error("Nepodařilo se uložit stav do paměti serveru.", error);
        }
      }, 120);
    }

    async function bootstrapFromServer() {
      const response = await fetch("/api/bootstrap");
      if (!response.ok) {
        throw new Error("Bootstrap API selhalo.");
      }
      const data = await response.json();
      demoState = data.demoState;
      patients = data.patients;
      organOffers = data.organOffers || [];
      faqs = data.faqs || [];
      referringNetwork = data.referringNetwork || { center: null, sites: [] };
      appConfig = data.config || appConfig;
      ensurePatientListUiState();
      ensurePatientsUpdatedAt();
      patients.forEach(dedupePatientFlowEvidence);
      migrateChatReadStateToRoles();
      migrateDocumentVisibility();
      ensureUserPreferences();
      ensurePersonalNotesStore();
      if (data.codeLists) applyCodeLists(data.codeLists);
      window.ProtocolHandbooks?.initFromState?.(data.handbooks, data.handbookCatalogByRole);
      window.LtxAdmin?.init?.({
        systemUsers: data.systemUsers,
        codeLists: data.codeLists,
        sharedMaterials: data.sharedMaterials,
        faqs: data.faqs,
        adminAudit: data.adminAudit,
        roles,
        onStateChange: () => {
          const adminState = window.LtxAdmin.getExportState();
          if (adminState) {
            faqs = adminState.faqs || [];
          }
          scheduleStateSync();
          render();
        }
      });
      demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      stateBootstrapped = true;
      render();
    }

    let phases = [
      { code: "POSUZOVANI", label: "V posuzování" },
      { code: "WL", label: "Na čekací listině" },
      { code: "PO_TX", label: "Po transplantaci" },
      { code: "UKONCENO", label: "Ukončeno" }
    ];

    const mainFlowPhases = () => phases.filter((phase) => phase.code !== "UKONCENO");

    let patientDailySymptoms = [
      { id: "dusnost", label: "dušnost" },
      { id: "kasel_hlen", label: "kašel s hlenem" },
      { id: "bolest_hrudi", label: "bolest na hrudi" },
      { id: "hemoptyza", label: "hemoptýza" },
      { id: "horecka", label: "horečka" },
      { id: "unava", label: "únava" },
      { id: "prujem", label: "průjem" },
      { id: "nechutenstvi", label: "nechutenství" }
    ];

    let patientDailySymptomLabel = Object.fromEntries(
      patientDailySymptoms.map((item) => [item.id, item.label])
    );

    function applyCodeLists(lists = {}) {
      if (lists.phases?.length) phases = lists.phases;
      if (lists.patientDailySymptoms?.length) {
        patientDailySymptoms = lists.patientDailySymptoms;
        patientDailySymptomLabel = Object.fromEntries(
          patientDailySymptoms.map((item) => [item.id, item.label])
        );
      }
    }

    function getPatientEducationVideos() {
      const shared = window.LtxAdmin?.getSharedMaterials?.() || {};
      const fromShared = [
        ...(shared.psych || []).filter((item) => item.active !== false),
        ...(shared.rehab || []).filter((item) => item.active !== false)
      ];
      const staticVideos = patientEducationVideos.filter((item) =>
        !fromShared.some((sharedItem) => sharedItem.id === item.id)
      );
      return [...staticVideos, ...fromShared.map((item) => ({
        id: item.id,
        category: item.category,
        duration: item.duration,
        title: item.title,
        author: item.author,
        description: item.description,
        attachments: item.attachments || []
      }))];
    }

    const roles = [
      { id: "coordinator", name: "Transplantační koordinátor", note: "Přehled pacientů a průběh cesty" },
      { id: "ambulatory", name: "Ambulantní pneumolog", note: "" },
      { id: "txPulmo", name: "Transplantační pneumolog", note: "Přehled pacientů v cestě (bez změny stavu)" },
      { id: "surgeon", name: "Transplantační chirurg", note: "Přehled pacientů v cestě (bez změny stavu)" },
      { id: "intensivist", name: "Anesteziolog a intenzivista", note: "Přehled pacientů v cestě (bez změny stavu)" },
      { id: "psychologist", name: "Psycholog", note: "Přehled pacientů v cestě (bez změny stavu)" },
      { id: "rehab", name: "Rehabilitační pracovník / Fyzioterapeut", note: "Přehled pacientů v cestě (bez změny stavu)" },
      { id: "patient", name: "Pacient", note: "Edukace, kontakty a sdílené zprávy" }
    ];

    function settingToggle(key, label, hint = "", defaultValue = true, showIf = null) {
      return { key, type: "toggle", label, hint, default: defaultValue, showIf };
    }

    function settingSelect(key, label, options, defaultValue, hint = "") {
      return { key, type: "select", label, hint, options, default: defaultValue };
    }

    function settingText(key, label, hint = "", defaultValue = "", placeholder = "") {
      return { key, type: "text", label, hint, default: defaultValue, placeholder };
    }

    const personalContactSettings = {
      id: "personal_contact",
      title: "Osobní spojení",
      items: [
        settingText("prefEmail", "e-mail pro notifikace", ""),
        settingText("prefPhone", "telefon pro notifikace", "")
      ]
    };

    const roleSettingsGroups = {
      patient: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Upozornění",
          items: [
            settingToggle("notifyEmailAppointments", "E-mail před plánovanou návštěvou", "Připomínka 24 h před termínem v centru."),
            settingToggle("notifySmsUrgent", "SMS při urgentní zprávě centra", "Pro akutní situace mimo běžnou komunikaci."),
            settingToggle("notifyDailyRecordReminder", "Připomínka k dennímu záznamu", "Ranní notifikace ve fázi čekací listiny nebo po transplantaci.", true, "dailyRecord"),
            settingToggle("notifyEducation", "Nový edukační obsah", "Krátké upozornění na doporučená videa a materiály.", false)
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs"),
            settingToggle("compactMode", "Kompaktní zobrazení", "Menší mezery a hustší seznamy na mobilu.", false)
          ]
        }
      ],
      ambulatory: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Notifikace k odeslaným pacientům",
          items: [
            settingToggle("notifyEmailPhaseChanges", "E-mail při změně fáze cesty", "Centrum informuje o posunu pacienta (posuzování, listina, TX)."),
            settingToggle("notifyEmailReferralChat", "E-mail u zpráv v chatu k žádosti", "Nová zpráva od koordinátora nebo centra."),
            settingToggle("notifyEmailSharedReports", "E-mail při sdílené zprávě z centra", "Výrok týmu nebo zpráva určená odesílateli."),
            settingSelect("notifyDigest", "Souhrn notifikací", [
              { value: "immediate", label: "Okamžitě" },
              { value: "daily", label: "Denní souhrn" },
              { value: "weekly", label: "Týdenní souhrn" }
            ], "immediate", "Sloučení více událostí do jednoho e-mailu.")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs"),
            settingToggle("notifyInAppSound", "Zvuk in-app upozornění", "Krátký signál při nové zprávě v aplikaci.")
          ]
        }
      ],
      coordinator: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Agenda koordinátora",
          items: [
            settingToggle("notifyEmailNewReferrals", "E-mail u nového odeslání", "Pacient odeslaný ambulantním pneumologem."),
            settingToggle("notifyEmailPhaseTasks", "E-mail při úkolech k přechodu fáze", "Připomínka uzavření kroku a odeslání výstupu."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu"),
            settingToggle("notifyEmailDailyRecordAlerts", "E-mail u rizikového domácího záznamu", "AI nebo prahové hodnoty u pacienta na listině / po TX.", true, "dailyRecordAlerts"),
            settingToggle("notifyEmailOrganOffers", "E-mail u aktualizace nabídky orgánu", "", true, "organOffers"),
            settingToggle("notifySmsUrgentTeam", "SMS pro urgentní koordinaci", "Nabídka orgánu nebo akutní eskalace.", false)
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ],
      txPulmo: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Klinická agenda",
          items: [
            settingToggle("notifyEmailPatientAlerts", "E-mail u informativních podnětů", "Trend domácích záznamů a klinické signály."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu"),
            settingToggle("notifyEmailDailyRecordTrends", "E-mail u významné změny trendu", "Týdenní nebo prudký pokles FEV1 / SpO2.", true, "dailyRecordAlerts"),
            settingToggle("notifyEmailOrganOffers", "E-mail u nabídky orgánu", "", true, "organOffers"),
            settingToggle("notifyEmailAmbulatoryMessages", "E-mail u zprávy od odesílatele", "Chat nebo doplnění k žádosti.")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ],
      surgeon: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Operační agenda",
          items: [
            settingToggle("notifyEmailOrganOffers", "E-mail u nabídky orgánu", "Nová nebo aktualizovaná nabídka k výkonu.", true, "organOffers"),
            settingToggle("notifyEmailPreTxPatients", "E-mail u pacienta před výkonem", "Zařazení na listinu a plánovaný termín TX."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ],
      intensivist: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Intenzivní péče",
          items: [
            settingToggle("notifyEmailOrganOffers", "E-mail u nabídky orgánu", "Koordinace JIP a perioperační kapacity.", true, "organOffers"),
            settingToggle("notifyEmailPeriOpPatients", "E-mail u perioperativního pacienta", "Přijetí na JIP nebo stabilizace po výkonu."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ],
      psychologist: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Psychologická péče",
          items: [
            settingToggle("notifyEmailEducationDue", "E-mail u edukačních mezníků", "Pacient nedokončil doporučený obsah."),
            settingToggle("notifyEmailPatientContact", "E-mail při žádosti pacienta o kontakt", "Prostřednictvím centra nebo aplikace."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ],
      rehab: [
        personalContactSettings,
        {
          id: "notifications",
          title: "Rehabilitace",
          items: [
            settingToggle("notifyEmailRehabSessions", "E-mail před plánovanou rehabilitací", "Pacient na listině nebo po TX."),
            settingToggle("notifyEmailExerciseAdherence", "E-mail u nízké adherence cvičení", "Pacient dlouho nepotvrdil domácí program."),
            settingToggle("notifyEmailInternalMentions", "E-mail při @zmínce v interním chatu")
          ]
        },
        {
          id: "app",
          title: "Aplikace",
          items: [
            settingSelect("language", "Jazyk rozhraní", [
              { value: "cs", label: "🇨🇿 Čeština" },
              { value: "en", label: "🇬🇧 English" }
            ], "cs")
          ]
        }
      ]
    };

    function ensureUserPreferences() {
      if (!demoState.userPreferences) demoState.userPreferences = {};
    }

    function ensurePersonalNotesStore() {
      if (!demoState.personalNotes) demoState.personalNotes = {};
    }

    const personalNotesRoles = ["coordinator", "txPulmo", "surgeon", "intensivist", "psychologist", "rehab"];

    function canUsePersonalNotes() {
      return personalNotesRoles.includes(activeUser().roleId);
    }

    function getPersonalNote(userId) {
      ensurePersonalNotesStore();
      return demoState.personalNotes[userId] || "";
    }

    function setPersonalNote(userId, text) {
      ensurePersonalNotesStore();
      demoState.personalNotes[userId] = text;
    }

    function updatePersonalNotesButtonState() {
      const wrap = document.getElementById("personalNotesWrap");
      const btn = document.getElementById("openPersonalNotesBtn");
      if (!wrap || !btn) return;

      const show = canUsePersonalNotes();
      wrap.hidden = !show;
      wrap.classList.toggle("is-visible", show);
      if (!show) {
        btn.classList.remove("has-content");
        return;
      }

      const hasContent = Boolean(getPersonalNote(activeUser().id).trim());
      btn.classList.toggle("has-content", hasContent);
      btn.title = hasContent ? "eNotes - máte uložený text" : "eNotes - osobní poznámky";
    }

    function openPersonalNotesModal() {
      if (!canUsePersonalNotes()) return;

      const user = activeUser();
      const input = document.getElementById("personalNotesInput");
      const sub = document.getElementById("personalNotesSub");
      if (input) input.value = getPersonalNote(user.id);
      if (sub) {
        sub.textContent = `Jen pro vás (${user.name}) - rychlý blok důležitých postřehů, vidí ho pouze váš účet.`;
      }

      document.getElementById("personalNotesModal")?.classList.add("open");
      syncPageScrollLock();
      requestAnimationFrame(() => {
        positionPersonalNotesModal();
        input?.focus();
      });
    }

    function closePersonalNotesModal() {
      document.getElementById("personalNotesModal")?.classList.remove("open");
      syncPageScrollLock();
    }

    function savePersonalNotes() {
      const user = activeUser();
      const input = document.getElementById("personalNotesInput");
      const text = input?.value.trim() || "";
      setPersonalNote(user.id, text);
      updatePersonalNotesButtonState();
      scheduleStateSync();
      closePersonalNotesModal();
      showToast(text ? "eNotes uloženy." : "eNotes byly vymazány.");
    }

    function getUserPreference(userId, key, defaultValue) {
      ensureUserPreferences();
      const prefs = demoState.userPreferences[userId];
      if (!prefs || !(key in prefs)) return defaultValue;
      return prefs[key];
    }

    function setUserPreference(userId, key, value) {
      ensureUserPreferences();
      if (!demoState.userPreferences[userId]) demoState.userPreferences[userId] = {};
      demoState.userPreferences[userId][key] = value;
    }

    function shouldShowSettingItem(item, user) {
      if (!item.showIf) return true;
      if (item.showIf === "dailyRecord") {
        const patient = user.patientId ? patients.find((entry) => entry.id === user.patientId) : null;
        return Boolean(patient && canPatientSubmitDailyRecord(patient));
      }
      if (item.showIf === "dailyRecordAlerts") {
        return patients.some((entry) => ["WL", "PO_TX"].includes(entry.state));
      }
      if (item.showIf === "organOffers") {
        return user.roleId === "coordinator" || user.roleId === "txPulmo" || user.roleId === "surgeon" || user.roleId === "intensivist";
      }
      return true;
    }

    function getRoleSettingsGroups(user) {
      const groups = roleSettingsGroups[user.roleId] || roleSettingsGroups.coordinator;
      return groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => shouldShowSettingItem(item, user))
        }))
        .filter((group) => group.items.length);
    }

    function renderSettingControl(item, user) {
      let defaultValue = item.default;
      if (item.key === "prefEmail") defaultValue = user.email;
      if (item.key === "prefPhone") defaultValue = user.phone;

      const value = getUserPreference(user.id, item.key, defaultValue);
      const controlId = `setting-${user.id}-${item.key}`;

      if (item.type === "select") {
        return `
          <div class="settings-row settings-row--select">
            <label class="settings-row-text" for="${controlId}">
              <strong>${escapeHtml(item.label)}</strong>
              ${item.hint ? `<span class="settings-row-hint">${escapeHtml(item.hint)}</span>` : ""}
            </label>
            <select
              id="${controlId}"
              class="settings-select"
              data-user-setting="${escapeHtml(item.key)}"
            >
              ${item.options.map((option) => `
                <option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `).join("")}
            </select>
          </div>
        `;
      }

      if (item.type === "text") {
        return `
          <div class="settings-row settings-row--text">
            <label class="settings-row-text" for="${controlId}">
              <strong>${escapeHtml(item.label)}</strong>
              ${item.hint ? `<span class="settings-row-hint">${escapeHtml(item.hint)}</span>` : ""}
            </label>
            <input
              type="text"
              id="${controlId}"
              class="settings-input"
              data-user-setting="${escapeHtml(item.key)}"
              value="${escapeHtml(value)}"
              placeholder="${escapeHtml(item.placeholder || "")}"
            >
          </div>
        `;
      }

      return `
        <label class="settings-row settings-row--toggle">
          <span class="settings-row-text">
            <strong>${escapeHtml(item.label)}</strong>
            ${item.hint ? `<span class="settings-row-hint">${escapeHtml(item.hint)}</span>` : ""}
          </span>
          <span class="settings-switch" aria-hidden="true">
            <input
              id="${controlId}"
              type="checkbox"
              class="settings-switch-input"
              data-user-setting="${escapeHtml(item.key)}"
              ${value ? "checked" : ""}
            >
            <span class="settings-switch-slider"></span>
          </span>
        </label>
      `;
    }

    function renderUserSettingsSection(user, extraRows = "") {
      const groups = getRoleSettingsGroups(user);
      const allItems = groups.flatMap((g) => g.items);

      return `
        <section class="card patient-portal-section user-settings-section">
          <h2 class="patient-portal-page-title">Nastavení</h2>
          <div class="user-settings-list">
            ${extraRows}
            ${allItems.map((item) => renderSettingControl(item, user)).join("")}
          </div>
        </section>
      `;
    }

    let demoUsers = [
      { id: "u-coord", name: "Bc. Petra Mertová", roleId: "coordinator", workplace: "FN Motol, koordinace LTx", email: "petra.mertova@motol.cz", phone: "+420 224 433 120", defaultPatientId: "p1", active: true, permissions: ["ADMIN"] },
      { id: "u-amb", name: "MUDr. Pavel Urban", roleId: "ambulatory", workplace: "Pneumologie Hradec Králové", email: "pavel.urban@fnhk.cz", phone: "+420 495 832 410", defaultPatientId: "p1", active: true, permissions: [] },
      { id: "u-tx", name: "MUDr. Jana Vavrová", roleId: "txPulmo", workplace: "FN Motol, transplantční pneumologie", email: "jana.vavrova@motol.cz", phone: "+420 224 433 210", defaultPatientId: "p5", active: true, permissions: [] },
      { id: "u-surg", name: "doc. MUDr. Petr Sima", roleId: "surgeon", workplace: "FN Motol, hrudní chirurgie", email: "petr.sima@motol.cz", phone: "+420 224 433 318", defaultPatientId: "p8", active: true, permissions: [] },
      { id: "u-icu", name: "MUDr. Karel Veselý", roleId: "intensivist", workplace: "FN Motol, KARIM/JIP", email: "karel.vesely@motol.cz", phone: "+420 224 433 901", defaultPatientId: "p8", active: true, permissions: [] },
      { id: "u-psych", name: "Mgr. Adam Havel", roleId: "psychologist", workplace: "Psychologická péče LTx", email: "adam.havel@motol.cz", phone: "+420 224 433 445", defaultPatientId: "p2", active: true, permissions: [] },
      { id: "u-rehab", name: "Mgr. Lucie Marková", roleId: "rehab", workplace: "Rehabilitace FN Motol", email: "lucie.markova@motol.cz", phone: "+420 224 433 512", defaultPatientId: "p2", active: true, permissions: [] },
      { id: "u-patient-wl", name: "Milan Král", roleId: "patient", workplace: "Pacient na čekací listině", email: "milan.kral@email.cz", phone: "+420 602 118 904", patientId: "p2", active: true, permissions: [] },
      { id: "u-patient-eval", name: "Eva Nováková", roleId: "patient", workplace: "Pacient v posuzování", email: "eva.novakova@email.cz", phone: "+420 601 234 567", patientId: "p1", active: false, permissions: [] },
      { id: "u-patient-fu", name: "Peter Hudák", roleId: "patient", workplace: "Pacient po transplantaci", email: "peter.hudak@email.cz", phone: "+420 603 987 210", patientId: "p4", active: true, permissions: [] }
    ];

    let demoState = {};

    let patients = [];
    let organOffers = [];

    function getPatientById(id) {
      return patients.find((p) => p.id === id) || null;
    }
    let faqs = [];

    let referringNetwork = { center: null, sites: [] };
    let appConfig = { googleMapsApiKey: "" };
    let referringMapRuntime = null;


    const ambulatoryDocs = {
      "p1-d1-pruvodni": {
        previewTitle: "Průvodní dopis - Eva Nováková",
        previewMeta: "PDF · 245 kB · MUDr. Pavel Urban · 20. 6. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická ambulance · Interní oddělení",
        docId: "HK-2026-8841",
        date: "20. 6. 2026",
        patient: { name: "Eva Nováková", rc: "705612/4821", diag: "IPF (J84.1)" },
        blocks: [
          { type: "title", text: "Žádost o posouzení indikace transplantace plic" },
          { type: "grid", rows: [
            ["Adresat", "FN Motol, Plicní klinika, transplantční program LTx"],
            ["Odesílající", "MUDr. Pavel Urban, Pneumologie HK"],
            ["Číslo případu LTx", "LTX-2026-0142"]
          ]},
          { type: "section", title: "Text dopisu", paragraphs: [
            "Vážení kolegové, zasílám paní Evu Novákovou, 56 let, s idiopatickou plicní fibrozou a progredující dušnosti za posledních 6 měsíců.",
            "Pacientka má opakované infekce DCH, progredující restrikci a pokles tolerance zátěže. Současná terapie: pirfenidon, inhalční bronchodilatace.",
            "Zadám kompletní posouzení indikace transplantace plic ve FN Motol. V příloze spirometrie, HRCT, laboratoř a propouštěcí zpráva."
          ]},
          { type: "grid", title: "Klíčové parametry", rows: [
            ["FEV1", "1,12 l (42 % pred.)"],
            ["DLCO", "31 % pred."],
            ["6MWT", "280 m"],
            ["SpO2 při chůzi", "91 %"]
          ]},
          { type: "list", title: "Předložené přílohy", items: [
            "Průvodní dopis (tento dokument)",
            "HRCT hrudníku - popis 18. 6. 2026",
            "Spirometrie 05/2026",
            "Laboratořní výsledky 14. 6. 2026"
          ]}
        ],
        signedBy: "MUDr. Pavel Urban",
        signedRole: "Ambulantní pneumolog, Pneumologie Hradec Králové",
        stamp: "ELEKTRONICKÝ PODPIS"
      },
      "p1-d1-hrct": {
        previewTitle: "HRCT - popis",
        previewMeta: "PDF · 1,2 MB · Radiologie FN HK · 18. 6. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Radiodiagnostické oddělení",
        docId: "RAD-2026-11842",
        date: "18. 6. 2026",
        patient: { name: "Eva Nováková", rc: "705612/4821", diag: "IPF - suspektní" },
        blocks: [
          { type: "title", text: "Zpráva z HRCT hrudníku" },
          { type: "grid", rows: [
            ["Vyšetření", "HRCT hrudníku bez kontrastu"],
            ["Indikace", "Progredující intersticiální onemocnění"],
            ["Porovnání", "HRCT 11/2025"]
          ]},
          { type: "section", title: "Nález", paragraphs: [
            "Progredující intersticiální postižení plic, převážně bazálně a subpleurálně.",
            "Vizualizace honeycombing v dolních polích. Bez suspektních plicních nodulů.",
            "Korelace s klinickou progresí IPF a restrikční ventilátorní poruchou."
          ]},
          { type: "section", title: "Závěr", paragraphs: [
            "Obraz odpovídá progredující idiopatické plicní fibroze. Doporučeno posouzení transplantčního programu."
          ]}
        ],
        signedBy: "MUDr. Simona Králová",
        signedRole: "Radiolog, radiodiagnostické oddělení"
      },
      "p1-d1-spiro": {
        previewTitle: "Spirometrie 05/2026",
        previewMeta: "PDF · 380 kB · Pneumologie HK · 15. 6. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická funkce",
        docId: "PF-2026-3301",
        date: "15. 6. 2026",
        patient: { name: "Eva Nováková", diag: "IPF" },
        blocks: [
          { type: "title", text: "Spirometrie a difuzní kapacita" },
          { type: "table", title: "Výsledky", headers: ["Parametr", "Naměřená", "% pred.", "Závěr"], rows: [
            ["FVC", "1,68 l", "52 %", "snížena"],
            ["FEV1", "1,12 l", "42 %", "snížena"],
            ["FEV1/FVC", "67 %", "-", "normální poměr"],
            ["DLCO", "-", "31 %", "významně snížena"]
          ]},
          { type: "section", title: "Interpretace", paragraphs: [
            "Restrikční ventilátorní porucha s progresí oproti spirometrii z 11/2025 (FEV1 48 % pred.).",
            "Výsledky podporují progresi onemocnění a indikaci k posouzení transplantace."
          ]}
        ],
        signedBy: "Mgr. Lenka Horáková",
        signedRole: "Klinický fyziolog, pneumologická funkce"
      },
      "p1-d1-lab": {
        previewTitle: "Laboratořní výsledky",
        previewMeta: "PDF · 156 kB · Laboratoř HK · 14. 6. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Centrální laboratoř",
        docId: "LAB-2026-99204",
        date: "14. 6. 2026",
        patient: { name: "Eva Nováková", rc: "705612/4821" },
        blocks: [
          { type: "title", text: "Laboratořní výsledky" },
          { type: "table", title: "Krevní testy", headers: ["Parametr", "Výsledek", "Referenční rozmezí"], rows: [
            ["Leukocyty", "8,2 × 10⁹/l", "4,0-10,0"],
            ["CRP", "12 mg/l", "< 5"],
            ["ALT", "28 U/l", "< 34"],
            ["Kreatinin", "78 µmol/l", "49-90"],
            ["NT-proBNP", "420 pg/ml", "< 125"]
          ]},
          { type: "section", title: "Komentář", paragraphs: [
            "Bez znaků akutní bakteriální infekce. Renální funkce v normě.",
            "Mírně zvýšený NT-proBNP odpovídá plicní hypertenzi v kontextu IPF."
          ]}
        ],
        signedBy: "MUDr. Tomáš Hrubý",
        signedRole: "Lékař laboratoře"
      },
      "p1-d2-přijetí": {
        previewTitle: "Potvrzení přijetí žádosti",
        previewMeta: "PDF · 88 kB · Bc. Petra Mertová · 21. 6. 2026 08:11",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační koordinace LTx",
        docId: "LTX-ADM-2026-0142",
        date: "21. 6. 2026",
        patient: { name: "Eva Nováková", rc: "705612/4821" },
        blocks: [
          { type: "title", text: "Potvrzení přijetí žádosti do LTx Pathway" },
          { type: "grid", rows: [
            ["Stav cesty", "V POSUZOVÁNÍ"],
            ["Odesílající lékař", "MUDr. Pavel Urban, Pneumologie HK"],
            ["Datum přijetí", "21. 6. 2026 08:11"]
          ]},
          { type: "section", title: "Obsah", paragraphs: [
            "Žádost o posouzení indikace transplantace plic byla přijata do systému transplantčního centra FN Motol.",
            "Rozhodnutí transplantčního týmu zatím nebylo vydáno.",
            "Další krok: příjmové vyšetření dle plánu koordinace."
          ]}
        ],
        signedBy: "Bc. Petra Mertová",
        signedRole: "Transplantační koordinátor, FN Motol",
        stamp: "PŘIJATO DO SYSTÉMU"
      },
      "p1-d2-plán": {
        previewTitle: "Plán příjmového vyšetření",
        previewMeta: "PDF · 124 kB · FN Motol · 21. 6. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Plicní klinika · Transplantační pneumologie",
        docId: "LTX-PLAN-2026-0142",
        date: "1. 7. 2026",
        patient: { name: "Eva Nováková", diag: "IPF - příjmové vyšetření" },
        blocks: [
          { type: "title", text: "Plán příjmového vyšetření" },
          { type: "schedule", title: "Harmonogram dne", items: [
            { time: "09:00", title: "Spirometrie, krevní odběry", place: "Ambulantní trakt, 2. patro" },
            { time: "10:30", title: "Kardiologické vyšetření", place: "Kardiologie FN Motol" },
            { time: "13:00", title: "Konzultace transplantční pneumologie", place: "Plicní klinika, konzultační místnost 4" }
          ]},
          { type: "section", title: "Poznámka", paragraphs: [
            "Po dokončení vyšetření bude podklad předložen transplantčnímu týmu k výroku.",
            "Výsledek bude sdílen s odesílajícím ambulantním pneumologem přes LTx Pathway."
          ]}
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Transplantační pneumolog, FN Motol"
      },
      "p4-d1-pruvodni": {
        previewTitle: "Průvodní dopis 03/2024 - Peter Hudák",
        previewMeta: "PDF · 198 kB · MUDr. Pavel Urban · 12. 3. 2024",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická ambulance",
        docId: "HK-2024-2103",
        date: "12. 3. 2024",
        patient: { name: "Peter Hudák", rc: "755312/6201", diag: "PAH (I27.0)" },
        blocks: [
          { type: "title", text: "Žádost o posouzení transplantace plic" },
          { type: "section", title: "Klinický souhrn", paragraphs: [
            "Pan Peter Hudák, 51 let, plicní arteriální hypertenze refrakterní na maximální medikální terapii.",
            "Progredující dušnost, pokles tolerance zátěže, opakované hospitalizace v roce 2023/2024."
          ]},
          { type: "grid", title: "Klíčové hodnoty", rows: [
            ["PAPs (echo)", "62 mmHg"],
            ["FEV1", "48 % pred."],
            ["6MWT", "310 m"],
            ["Terapie", "Dvojitá PAH terapie + antikoagulace"]
          ]}
        ],
        signedBy: "MUDr. Pavel Urban",
        signedRole: "Ambulantní pneumolog"
      },
      "p4-d1-echo": {
        previewTitle: "Echokardiografie",
        previewMeta: "PDF · 890 kB · Kardiologie · 10. 3. 2024",
        institution: "Fakultní nemocnice v Motole",
        department: "Kardiologické oddělení",
        docId: "KAR-ECHO-2024-8821",
        date: "10. 3. 2024",
        patient: { name: "Peter Hudák", diag: "PAH" },
        blocks: [
          { type: "title", text: "Echokardiografická zpráva" },
          { type: "table", title: "Hemodynamika a komory", headers: ["Parametr", "Výsledek", "Poznámka"], rows: [
            ["PAPs", "62 mmHg", "významně zvýšená"],
            ["RV dilatace", "přítomna", "pravá komora dilatovaná"],
            ["LVEF", "55 %", "zachována"],
            ["TAPSE", "14 mm", "snížena systolická funkce PK"]
          ]},
          { type: "section", title: "Závěr", paragraphs: [
            "Obraz odpovídá progredující plicní arteriální hypertenzi s postižení pravé komory.",
            "Doporučeno posouzení transplantčního programu."
          ]}
        ],
        signedBy: "MUDr. Karel Novotný",
        signedRole: "Kardiolog, FN Motol"
      },
      "p4-d1-spiro": {
        previewTitle: "Spirometrie",
        previewMeta: "PDF · 320 kB · 8. 3. 2024",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická funkce",
        docId: "PF-2024-1844",
        date: "8. 3. 2024",
        patient: { name: "Peter Hudák" },
        blocks: [
          { type: "title", text: "Spirometrie" },
          { type: "table", title: "Výsledky", headers: ["Parametr", "Naměřená", "% pred."], rows: [
            ["FVC", "2,45 l", "58 %"],
            ["FEV1", "1,89 l", "48 %"],
            ["FEV1/FVC", "77 %", "-"]
          ]},
          { type: "section", title: "Interpretace", paragraphs: ["Restrikční ventilátorní porucha koreluje s progresí PAH."] }
        ],
        signedBy: "Mgr. Lenka Horáková",
        signedRole: "Klinický fyziolog"
      },
      "p4-d2-výrok": {
        previewTitle: "Záznam výroku týmu",
        previewMeta: "PDF · 178 kB · Transplantační tým · 28. 8. 2025",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační tým LTx",
        docId: "LTX-VYR-2025-0882",
        date: "28. 8. 2025",
        patient: { name: "Peter Hudák", diag: "PAH" },
        blocks: [
          { type: "title", text: "Záznam výroku transplantčního týmu" },
          { type: "verdict", variant: "warn", title: "VYROK: ZAŘADIT NA ČEKACÍ LISTINU", text: "Pacient splňuje indikační kritéria pro transplantaci plic.", note: "Indikační kritéria splněna. Pacient připraven na zařazení po doplnění administrativních podkladů." },
          { type: "grid", rows: [
            ["Datum konzilia", "28. 8. 2025"],
            ["Účastníci", "transplant. pneumolog, chirurg, koordinátor, anesteziolog"],
            ["Stav cesty", "NA ČEKACÍ LISTINĚ"]
          ]}
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Za transplantní tým, FN Motol",
        stamp: "VYROK TÝMU"
      },
      "p4-d2-zařazení": {
        previewTitle: "Potvrzení zařazení na WL",
        previewMeta: "PDF · 96 kB · Bc. Petra Mertová · 1. 9. 2025",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační koordinace LTx",
        docId: "LTX-WL-2025-0882",
        date: "1. 9. 2025",
        patient: { name: "Peter Hudák" },
        blocks: [
          { type: "title", text: "Potvrzení zařazení na čekací listinu" },
          { type: "verdict", variant: "warn", title: "NA ČEKACÍ LISTINĚ", text: "Pacient byl zařazen na čekací listinu transplantace plic dne 1. 9. 2025." },
          { type: "section", title: "Další postup", paragraphs: [
            "Pacient čeká na výkon transplantace. Ambulantní pneumolog informovaný přes LTx Pathway.",
            "Kontakt pro urgentní situace: koordinace LTx +420 224 43 2100."
          ]}
        ],
        signedBy: "Bc. Petra Mertová",
        signedRole: "Transplantační koordinátor"
      },
      "p4-d3-operační": {
        previewTitle: "Operační zpráva",
        previewMeta: "PDF · 420 kB · doc. MUDr. Petr Sima · 18. 9. 2025",
        institution: "Fakultní nemocnice v Motole",
        department: "Oddělení hrudní chirurgie",
        docId: "CHIR-OP-2025-4412",
        date: "18. 9. 2025",
        patient: { name: "Peter Hudák", diag: "PAH - bilaterální LTx" },
        blocks: [
          { type: "title", text: "Operační zpráva" },
          { type: "grid", rows: [
            ["Vykon", "Bilaterální transplantace plic"],
            ["Datum operace", "18. 9. 2025"],
            ["Operatér", "doc. MUDr. Petr Sima"],
            ["Anestezie", "celková anestezie, jednokanálová ventilace"]
          ]},
          { type: "section", title: "Pooperační průběh", paragraphs: [
            "Výkon proběhl bez zásadních chirurgických komplikací.",
            "Pacient transferovaný na JIP KARIM po stabilizaci hemodynamiky.",
            "Primární funkce graftu uspokojivá."
          ]}
        ],
        signedBy: "doc. MUDr. Petr Sima",
        signedRole: "Transplantační chirurg, FN Motol"
      },
      "p4-d3-výkon": {
        previewTitle: "Záznam o výkonu",
        previewMeta: "PDF · 156 kB · FN Motol · 18. 9. 2025",
        institution: "Fakultní nemocnice v Motole",
        department: "LTx Pathway · Klinická dokumentace",
        docId: "LTX-VYK-2025-4412",
        date: "18. 9. 2025",
        patient: { name: "Peter Hudák" },
        blocks: [
          { type: "title", text: "Záznam o výkonu transplantace plic" },
          { type: "grid", rows: [
            ["Typ výkonu", "Bilaterální transplantace plic"],
            ["Datum výkonu", "18. 9. 2025"],
            ["Stav cesty v LTx Pathway", "PO TRANSPLANTACI"]
          ]},
          { type: "section", title: "Systémový záznam", paragraphs: [
            "Záznam vytvořen v LTx Pathway po dokončení výkonu.",
            "Informace sdílená s ambulantním pneumologem odesílajícím pacienta."
          ]}
        ],
        signedBy: "Bc. Petra Mertová",
        signedRole: "Transplantační koordinátor"
      },
      "p4-d3-propuštění": {
        previewTitle: "Propouštěcí zpráva",
        previewMeta: "PDF · 312 kB · FN Motol · 2. 10. 2025",
        institution: "Fakultní nemocnice v Motole",
        department: "Plicní klinika",
        docId: "PROP-2025-4412",
        date: "2. 10. 2025",
        patient: { name: "Peter Hudák", diag: "po bilaterální LTx" },
        blocks: [
          { type: "title", text: "Propouštěcí zpráva" },
          { type: "section", title: "Stav při propuštění", paragraphs: [
            "Pacient stabilizovaný po bilaterální transplantaci plic. Mobilizace bez kyslíku.",
            "Imunosupresivní režim nastaven, edukace proveděna."
          ]},
          { type: "list", title: "Doporučení po propuštění", items: [
            "Návrat do ambulantní péče v regionu (MUDr. Pavel Urban)",
            "Kontroly FN Motol každé 3 měsíce",
            "Sdílená spirometrie a domácí měření přes LTx Pathway",
            "Ambulantní pneumolog vede běžný režim mimo centrum"
          ]}
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Transplantační pneumolog, FN Motol"
      },
      "p6-d1-pruvodni": {
        previewTitle: "Průvodní dopis - Josef Dvořák",
        previewMeta: "PDF · 210 kB · MUDr. Pavel Urban · 5. 3. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická ambulance",
        docId: "HK-2026-3305",
        date: "5. 3. 2026",
        patient: { name: "Josef Dvořák", rc: "636412/1842", diag: "CHOPN J44.9" },
        blocks: [
          { type: "title", text: "Žádost o posouzení transplantace plic" },
          { type: "section", title: "Klinický souhrn", paragraphs: [
            "Pan Josef Dvořák, 62 let, těžkou CHOPN s emfyzemem. Opakované hospitalizace kvůli exacerbaci.",
            "Progredující restrikce, dušnost i při běžné domácí aktivitě, BODE index 7."
          ]},
          { type: "grid", title: "Parametry", rows: [
            ["FEV1", "28 % pred."],
            ["DLCO", "24 % pred."],
            ["BODE index", "7"],
            ["Kyslík", "dlouhodobě 2 l/min při chůzi"]
          ]}
        ],
        signedBy: "MUDr. Pavel Urban",
        signedRole: "Ambulantní pneumolog"
      },
      "p6-d1-hosp": {
        previewTitle: "Záznam hospitalizace",
        previewMeta: "PDF · 540 kB · FN Pardubice · 28. 2. 2026",
        institution: "Fakultní nemocnice Pardubice",
        department: "Interní oddělení",
        docId: "PD-HOSP-2026-0218",
        date: "28. 2. 2026",
        patient: { name: "Josef Dvořák" },
        blocks: [
          { type: "title", text: "Propouštěcí zpráva z hospitalizace" },
          { type: "section", title: "Diagnóza při přijetí", paragraphs: ["Exacerbace CHOPN, respirační insuficience."] },
          { type: "section", title: "Léčba", paragraphs: [
            "Antibiotická léčba, systémové kortikoidy, bronchodilatace, kyslíková terapie.",
            "Při propuštění persistující restrikce, FEV1 28 % pred."
          ]}
        ],
        signedBy: "MUDr. Radim Jelínek",
        signedRole: "Internísta, FN Pardubice"
      },
      "p6-d1-spiro": {
        previewTitle: "6MWT a spirometrie",
        previewMeta: "PDF · 290 kB · 25. 2. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická funkce",
        docId: "PF-2026-2901",
        date: "25. 2. 2026",
        patient: { name: "Josef Dvořák" },
        blocks: [
          { type: "title", text: "Spirometrie a 6MWT" },
          { type: "table", title: "Výsledky", headers: ["Test", "Výsledek", "Poznámka"], rows: [
            ["FEV1", "28 % pred.", "významně snížena"],
            ["DLCO", "24 % pred.", "významně snížena"],
            ["6MWT", "210 m", "desaturace na 86 %"]
          ]},
          { type: "section", title: "Závěr", paragraphs: ["Podklad pro indikační posouzení transplantace plic."] }
        ],
        signedBy: "Mgr. Lenka Horáková",
        signedRole: "Klinický fyziolog"
      },
      "p6-d2-výrok": {
        previewTitle: "Záznam výroku týmu",
        previewMeta: "PDF · 165 kB · Transplantační tým · 10. 4. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační tým LTx",
        docId: "LTX-VYR-2026-0312",
        date: "10. 4. 2026",
        patient: { name: "Josef Dvořák", diag: "CHOPN" },
        blocks: [
          { type: "title", text: "Záznam výroku transplantčního týmu" },
          { type: "verdict", variant: "warn", title: "VYROK: ZAŘADIT NA ČEKACÍ LISTINU", text: "Pacient splňuje indikační kritéria pro transplantaci plic.", note: "Administrativní podklady doplněny. Stav cesty: NA ČEKACÍ LISTINĚ." },
          { type: "grid", rows: [
            ["Datum konzilia", "10. 4. 2026"],
            ["Psychologický screening", "proveden, bez výhrad"],
            ["Nutriční status", "suboptimální, plán intervence"]
          ]}
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Za transplantní tým",
        stamp: "VYROK TÝMU"
      },
      "p6-d2-plán": {
        previewTitle: "Plán péče na WL",
        previewMeta: "PDF · 98 kB · FN Motol · 10. 4. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační koordinace LTx",
        docId: "LTX-PLAN-WL-0312",
        date: "10. 4. 2026",
        patient: { name: "Josef Dvořák" },
        blocks: [
          { type: "title", text: "Plán péče na čekací listině" },
          { type: "list", title: "Povinnosti pacienta a péče", items: [
            "Kontrolní krevní odběry měsíčně v FN Motol",
            "Rehabilitace a edukace dle programu WL",
            "Okamžitě hlášení zhoršení stavu (teplota, kašel, dušnost)",
            "Ambulantní pneumolog sleduje stav v regionu"
          ]},
          { type: "section", title: "Kontakt", paragraphs: ["Koordinace LTx: +420 224 43 2100, plicní.tx@fnmotol.cz"] }
        ],
        signedBy: "Bc. Petra Mertová",
        signedRole: "Transplantační koordinátor"
      },
      "p6-d3-informace": {
        previewTitle: "Informace pro péči na WL",
        previewMeta: "PDF · 72 kB · Bc. Petra Mertová · 22. 3. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační koordinace LTx",
        docId: "LTX-INFO-WL-0312",
        date: "22. 3. 2026",
        patient: { name: "Josef Dvořák" },
        blocks: [
          { type: "title", text: "Informace pro ambulantní péči na čekací listině" },
          { type: "section", title: "Stav", paragraphs: [
            "Pacient je na čekací listině. Transplantace zatím neproběhla.",
            "Další krok: čekání na výkon transplantace dle prioritního řazení KST."
          ]},
          { type: "grid", rows: [
            ["Stav cesty", "NA ČEKACÍ LISTINĚ - čeká transplantace"],
            ["Urgentní kontakt", "+420 224 43 2100"],
            ["Ambulantní péči vede", "MUDr. Pavel Urban, HK"]
          ]}
        ],
        signedBy: "Bc. Petra Mertová",
        signedRole: "Transplantační koordinátor"
      },
      "p7-d1-pruvodni": {
        previewTitle: "Průvodní dopis - Marie Horáková",
        previewMeta: "PDF · 210 kB · MUDr. Pavel Urban · 8. 1. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická ambulance",
        docId: "HK-2026-0108",
        date: "8. 1. 2026",
        patient: { name: "Marie Horáková", rc: "685812/3751", diag: "IPF" },
        blocks: [
          { type: "title", text: "Žádost o posouzení transplantace plic" },
          { type: "section", title: "Indikace", paragraphs: [
            "Paní Marie Horáková, 58 let, progredující IPF.",
            "FEV1 35 % pred., DLCO 28 % pred., progrese onemocnění za poslední rok."
          ]},
          { type: "grid", title: "Současná terapie", rows: [
            ["Pirfenidon", "ukončeno pro neefektivitu"],
            ["Kyslík", "2 l/min při chůzi"],
            ["Rehabilitace", "omezena dušností"]
          ]}
        ],
        signedBy: "MUDr. Pavel Urban",
        signedRole: "Ambulantní pneumolog"
      },
      "p7-d1-spiro": {
        previewTitle: "Spirometrie",
        previewMeta: "PDF · 290 kB · 5. 1. 2026",
        institution: "Krajská nemocnice Hradec Králové",
        department: "Pneumologická funkce",
        docId: "PF-2026-0105",
        date: "5. 1. 2026",
        patient: { name: "Marie Horáková" },
        blocks: [
          { type: "title", text: "Spirometrie" },
          { type: "table", title: "Výsledky", headers: ["Parametr", "Naměřená", "% pred."], rows: [
            ["FVC", "1,42 l", "45 %"],
            ["FEV1", "0,98 l", "35 %"],
            ["DLCO", "-", "28 %"]
          ]},
          { type: "section", title: "Interpretace", paragraphs: ["Progredující restrikční porucha. IPF bez další terapeutické možnosti v regionu."] }
        ],
        signedBy: "Mgr. Lenka Horáková",
        signedRole: "Klinický fyziolog"
      },
      "p7-d2-výrok": {
        previewTitle: "Záznam výroku týmu",
        previewMeta: "PDF · 178 kB · Transplantační tým · 5. 5. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Transplantační tým LTx",
        docId: "LTX-VYR-2026-0078",
        date: "5. 5. 2026",
        patient: { name: "Marie Horáková", diag: "IPF" },
        blocks: [
          { type: "title", text: "Záznam výroku transplantčního týmu" },
          { type: "verdict", variant: "critical", title: "VYROK: NEZAŘADIT NA ČEKACÍ LISTINU", text: "Transplantace plic v aktuálním stadiu onemocnění není indikována.", note: "Stav cesty: UKONCENO. Doporučená optimalizace symptomatické terapie v ambulantní péči." },
          { type: "section", title: "Důvod", paragraphs: [
            "Tým zhodnotil progresi onemocnění, ale indikační kritéria pro transplantaci v aktuálním stadiu nejsou splněny.",
            "Doporučeno pokračovat v dosavadní péči u odesílajícího pneumologu."
          ]}
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Za transplantní tým",
        stamp: "VYROK TÝMU"
      },
      "p7-d2-doporučení": {
        previewTitle: "Doporučení pro ambulantní péči",
        previewMeta: "PDF · 92 kB · FN Motol · 5. 5. 2026",
        institution: "Fakultní nemocnice v Motole",
        department: "Plicní klinika",
        docId: "LTX-DOP-2026-0078",
        date: "5. 5. 2026",
        patient: { name: "Marie Horáková" },
        blocks: [
          { type: "title", text: "Doporučení pro ambulantní péči" },
          { type: "list", title: "Další postup", items: [
            "Pokračovat v péči u MUDr. Pavla Urbana, Pneumologie HK",
            "Optimalizace symptomatické terapie a rehabilitace",
            "Kyslíková terapie dle tolerance",
            "Bez indikace transplantace - posuzování ukončeno"
          ]},
          { type: "section", title: "Sdílení", paragraphs: ["Dokument sdílený s ambulantním pneumologem přes LTx Pathway."] }
        ],
        signedBy: "MUDr. Jana Vavrová",
        signedRole: "Transplantační pneumolog, FN Motol"
      }
    };

    const ambulatoryMessages = [
      {
        id: "m1",
        patientId: "p1",
        from: "Bc. Petra Mertová, transplantační koordinátor",
        subject: "Nové odeslání přijato",
        date: "21. 6. 2026 08:11",
        preview: "Odeslání paní Novákové bylo přijato. Plánujeme příjmové vyšetření 1. 7. 2026. Prosím o doplnění poslední laboratorní kontroly, pokud je k dispozici.",
        unread: true
      },
      {
        id: "m-p2-wl",
        patientId: "p2",
        from: "Bc. Petra Mertová, transplantační koordinátor",
        subject: "Zařazení na čekací listinu - Milan Král",
        date: "16. 3. 2026 11:00",
        preview: "Pacient byl zařazen na čekací listinu. Zasíláme výrok týmu a plán péče na WL.",
        attachments: [
          { id: "p2-d2-vyrok", name: "Výrok týmu - zařadit", type: "PDF", size: "165 kB" },
          { id: "p2-d2-plan", name: "Plán péče na WL", type: "PDF", size: "98 kB" }
        ],
        unread: false
      },
      {
        id: "m2",
        patientId: "p6",
        from: "MUDr. Jana Vavrová, transplantační pneumolog",
        subject: "Stav na čekací listině - Josef Dvořák",
        date: "20. 6. 2026 15:30",
        preview: "Pacient je stabilní na WL. Prosíme o informaci, pokud by se zhoršil stav nebo byla potřeba hospitalizace v regionu.",
        unread: false
      },
      {
        id: "m3",
        patientId: "p4",
        from: "MUDr. Jana Vavrová, transplantační pneumolog",
        subject: "Sdílený follow-up - Peter Hudák",
        date: "18. 6. 2026 10:05",
        preview: "Pacient je 9 měsíců po TX, stabilní. Sdílíme trend FEV1 a plán kontroly 8. 7. Ambulantní pneumolog vede běžný režim mimo centrum.",
        attachments: [
          { name: "Trend FEV1 06/2026", type: "PDF", size: "124 kB" },
          { name: "Plán kontroly 07/2026", type: "PDF", size: "86 kB" }
        ],
        unread: false
      },
      {
        id: "m4",
        patientId: "p7",
        from: "MUDr. Jana Vavrová, transplantační pneumolog",
        subject: "Výrok týmu - Marie Horáková",
        date: "5. 5. 2026 16:00",
        preview: "Tým doporučil pokračovat v dosavadní ambulantní péči, transplantace v aktuálním stadiu není indikována. Zasíláme záznam výroku týmu a doporučení pro další péči.",
        attachments: [
          { name: "Záznam výroku týmu", type: "PDF", size: "178 kB" },
          { name: "Doporučení pro ambulantní péči", type: "PDF", size: "92 kB" }
        ],
        unread: false
      },
      {
        id: "m5",
        patientId: "p4",
        from: "doc. MUDr. Petr Sima, transplantační chirurg",
        subject: "Záznam o transplantaci - Peter Hudák",
        date: "18. 9. 2025 17:40",
        preview: "Bilaterální transplantace plic proběhla bez zásadních chirurgických komplikací. Zasíláme operační zpravu a základní pooperační plán.",
        attachments: [
          { name: "Operační zpráva", type: "PDF", size: "420 kB" },
          { name: "Záznam o výkonu", type: "PDF", size: "156 kB" }
        ],
        unread: false
      },
      {
        id: "m6",
        patientId: "p6",
        from: "Bc. Petra Mertová, transplantační koordinátor",
        subject: "Zařazení na čekací listinu - Josef Dvořák",
        date: "22. 3. 2026 11:15",
        preview: "Pacient byl zařazen na čekací listinu. Zasíláme výrok týmu, plán péče na čekací listině a kontakty pro urgentní komunikaci.",
        attachments: [
          { name: "Výrok týmu - zařadit", type: "PDF", size: "165 kB" },
          { name: "Plán péče na WL", type: "PDF", size: "98 kB" }
        ],
        unread: false
      }
    ];

    const education = [
      { title: "Jak probíhá transplantace plic", type: "Video", audience: "WL i po TX", duration: "12 min" },
      { title: "Dechová cvičení před transplantací", type: "Video fyzioterapie", audience: "WL", duration: "9 min" },
      { title: "Zkušenosti pacienta po návratu domů", type: "Příběh pacienta", audience: "Po TX", duration: "7 min" },
      { title: "Imunosuprese a bezpečný režim", type: "Edukční karta", audience: "Po TX", duration: "5 min" }
    ];

    const patientEducationVideos = [
      {
        id: "edu-tx",
        category: "Operace & průběh",
        duration: "12 min",
        title: "Jak probíhá transplantace plic",
        author: "Transplantační chirurg",
        description: "Průběh výkonu, příprava na sál, co očekávat bezprostředně po operaci."
      },
      {
        id: "edu-icu",
        category: "Operace & průběh",
        duration: "8 min",
        title: "Anestezie a JIP - první hodiny",
        author: "Anesteziolog / intenzivista",
        description: "Probuzení z anestezie, pobyt na JIP, drény, ventilace."
      },
      {
        id: "edu-psych",
        category: "Psychika & podpora",
        duration: "15 min",
        title: "Psychika před a po transplantaci",
        author: "Psycholog programu",
        description: "Zvládání nejistoty na čekací listině, podpora rodiny, návrat do života."
      },
      {
        id: "edu-rehab",
        category: "Rehabilitace",
        duration: "10 min",
        title: "Prerehabilitace - dechová cvičení",
        author: "Rehabilitační / fyzioterapeut",
        description: "Sada cviků pro každodenní domácí prerehabilitaci a posílení dechových svalů."
      }
    ];

    const patientEmergencyContact = {
      label: "Akutní obtíže (RZP)",
      phone: "155",
      note: "V případě akutních obtíží volejte ihned!",
      noteSub: "Jednotné evropské číslo tísňového volání."
    };

    const ambulatoryEmergencyContact = {
      label: "Hotline pro lékaře",
      phone: "+420 224 433 111",
      note: "Určeno pro akutní konzultace lékař-lékař.",
      noteSub: "Dostupné 24/7 pro indikující pneumology."
    };

    const patientCenterContacts = [
      {
        id: "coord",
        label: "Transplantační koordinátor",
        phone: "+420 224 433 555",
        hours: "Po-Pá 8-16",
        icon: "contact-coord"
      },
      {
        id: "hotline",
        label: "Pohotovostní linka centra",
        phone: "+420 224 433 999",
        hours: "24/7",
        icon: "contact-hotline",
        variant: "hotline"
      },
      {
        id: "tx-pulmo",
        label: "Transplantační pneumolog (sekretariát)",
        phone: "+420 224 433 444",
        icon: "contact-lungs"
      },
      {
        id: "psych",
        label: "Psycholog programu",
        phone: "+420 224 433 333",
        icon: "contact-brain"
      },
      {
        id: "rehab",
        label: "Rehabilitační / fyzioterapeut",
        phone: "+420 224 433 222",
        icon: "contact-rehab"
      }
    ];

    const ambulatoryCenterContacts = [
      {
        id: "coord-lead",
        label: "Vedoucí koordinátor LTx",
        phone: "+420 224 433 210",
        hours: "Po-Pá 8-16",
        icon: "contact-coord"
      },
      {
        id: "tx-pulmo-lead",
        label: "Vedoucí transplantační pneumolog",
        phone: "+420 224 433 440",
        icon: "contact-lungs"
      },
      {
        id: "ref-desk",
        label: "Příjmová ambulance (konzultace)",
        phone: "+420 224 433 441",
        hours: "Po-Pá 8-15",
        icon: "calendar"
      },
      {
        id: "secretariat",
        label: "Sekretariát Plicní kliniky",
        phone: "+420 224 433 401",
        icon: "info"
      }
    ];

    const clinicalTeamRoles = ["txPulmo", "surgeon", "intensivist", "psychologist", "rehab"];

    const contacts = [
      { name: "MUDr. Jana Vavrová", role: "Transplantační pneumolog", contact: "plicní.tx@fnmotol.cz" },
      { name: "Bc. Petra Mertová", role: "Transplantační koordinátor", contact: "+420 224 43 2100" },
      { name: "Mgr. Adam Havel", role: "Psycholog", contact: "psycholog.tx@fnmotol.cz" },
      { name: "Mgr. Lucie Marková", role: "Fyzioterapie", contact: "rehab.tx@fnmotol.cz" },
      { name: "Oddělení hrudní chirurgie", role: "Kontakt na oddělení", contact: "+420 224 43 3300" }
    ];

    const tasks = [
      { owner: "Koordinátor", title: "Převzít nové odeslání", patientId: "p1", due: "dnes", status: "otevřeno" },
      { owner: "Transplantační pneumolog", title: "Posoudit hlášení zhoršení", patientId: "p2", due: "dnes", status: "v řešení" },
      { owner: "Psycholog", title: "Doplnit edukační kontakt", patientId: "p2", due: "26. 6.", status: "otevřeno" },
      { owner: "Rehabilitace", title: "Aktualizovat domácí cvičení", patientId: "p4", due: "15. 7.", status: "plánováno" }
    ];

    function selectedPatient() {
      return patients.find((patient) => patient.id === demoState.patientId) || patients[0];
    }

    function activeUser() {
      const users = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      return users.find((user) => user.id === demoState.userId) || users[0];
    }

    function isAdminModeActive() {
      return Boolean(demoState.adminModeActive);
    }

    function activeRoleId() {
      if (isAdminModeActive()) return "admin";
      return activeUser().roleId;
    }

    function hasAdminPermission(user = activeUser()) {
      return window.LtxAdmin?.hasAdminPermission?.(user) || false;
    }

    function roleById(roleId) {
      if (roleId === "admin") {
        return { id: "admin", name: "Správa systému", note: "Režim správy (oprávnění ADMIN)" };
      }
      return roles.find((role) => role.id === roleId) || roles[0];
    }

    function isPatientUser() {
      return activeUser().roleId === "patient";
    }

    function canShowCenterContactNav(user = activeUser()) {
      return user.roleId === "patient" || user.roleId === "ambulatory";
    }

    function isClinicalTeamViewer() {
      return clinicalTeamRoles.includes(activeUser().roleId);
    }

    function canAccessOrganOffers() {
      const roleId = activeUser().roleId;
      return roleId === "coordinator" || roleId === "txPulmo" || roleId === "surgeon";
    }

    function canAccessReferringNetwork() {
      const roleId = activeUser().roleId;
      return roleId === "coordinator" || roleId === "txPulmo" || roleId === "surgeon" || roleId === "intensivist";
    }

    function selectedReferringSite() {
      const siteId = demoState.referringSiteId;
      if (!siteId) return null;
      if (siteId === referringNetwork.center?.id) return referringNetwork.center;
      return (referringNetwork.sites || []).find((item) => item.id === siteId) || null;
    }

    function referralFlowLineWidth(count) {
      if (count >= 8) return 5;
      if (count >= 4) return 3;
      return 1.5;
    }

    function referralFlowLineOpacity(count) {
      if (count >= 8) return 0.55;
      if (count >= 4) return 0.38;
      return 0.22;
    }

    const REFERRING_CITY_GEO = {
      motol: { lon: 14.358, lat: 50.074 },
      brno: { lon: 16.607, lat: 49.195 },
      bratislava: { lon: 17.108, lat: 48.149 },
      ostrava: { lon: 18.282, lat: 49.836 },
      hradec: { lon: 15.833, lat: 50.209 },
      plzen: { lon: 13.378, lat: 49.748 },
      olomouc: { lon: 17.253, lat: 49.594 },
      kosice: { lon: 21.258, lat: 48.716 },
      liberec: { lon: 15.058, lat: 50.766 },
      usti: { lon: 14.044, lat: 50.661 },
      pardubice: { lon: 15.781, lat: 50.037 },
      budejovice: { lon: 14.475, lat: 48.975 },
      jihlava: { lon: 15.591, lat: 49.396 },
      presov: { lon: 21.239, lat: 49.005 },
      zilina: { lon: 18.741, lat: 49.223 },
      martin: { lon: 18.924, lat: 49.065 },
      bb: { lon: 19.145, lat: 48.736 },
      trnava: { lon: 17.588, lat: 48.377 },
      nitra: { lon: 18.085, lat: 48.307 },
      trutnov: { lon: 15.913, lat: 50.565 }
    };

    function getReferringSiteLatLng(site) {
      const geo = REFERRING_CITY_GEO[site?.id];
      if (!geo) return null;
      return { lat: geo.lat, lng: geo.lon };
    }

    function findReferringSiteById(siteId) {
      if (referringNetwork.center?.id === siteId) return referringNetwork.center;
      return (referringNetwork.sites || []).find((item) => item.id === siteId) || null;
    }

    async function loadGoogleMapsRuntime(apiKey) {
      if (!window.google?.maps?.importLibrary) {
        await new Promise((resolve, reject) => {
          const callbackName = "__ltxGoogleMapsInit";
          window[callbackName] = () => {
            delete window[callbackName];
            resolve();
          };
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${callbackName}`;
          script.async = true;
          script.onerror = () => {
            delete window[callbackName];
            reject(new Error("Google Maps API se nepodařilo načíst."));
          };
          document.head.appendChild(script);
        });
      }

      const [mapsLib, markerLib, coreLib] = await Promise.all([
        google.maps.importLibrary("maps"),
        google.maps.importLibrary("marker"),
        google.maps.importLibrary("core")
      ]);

      return { mapsLib, markerLib, coreLib };
    }

    function createReferringMarkerContent({ isCenter = false, isSelected = false } = {}) {
      const fill = isSelected ? "#e07a3a" : isCenter ? "#0d2538" : "#2b6cb0";
      const root = document.createElement("div");
      root.className = [
        "referring-advanced-marker",
        isCenter ? "referring-advanced-marker--center" : "",
        isSelected ? "referring-advanced-marker--selected" : ""
      ].filter(Boolean).join(" ");

      if (isCenter) {
        const ring = document.createElement("span");
        ring.className = "referring-advanced-marker-ring";
        ring.style.borderColor = fill;
        root.appendChild(ring);
      }

      const dot = document.createElement("span");
      dot.className = "referring-advanced-marker-dot";
      dot.style.backgroundColor = fill;
      root.appendChild(dot);

      return root;
    }

    function renderReferringSiteInfoHtml(site) {
      const isCenter = site.id === referringNetwork.center?.id;
      const volume = site.referrals12m;

      return `
        <div class="referring-site-info-window">
          <h4>${site.institution || site.name}</h4>
          <p class="referring-site-popup-meta">${site.city}${site.country ? ` · ${site.country}` : ""}${site.department ? ` · ${site.department}` : ""}</p>
          ${!isCenter && volume != null ? `<p class="referring-site-popup-volume">Odeslání za 12 m.: <strong>${volume}</strong></p>` : ""}
          <div class="referring-site-contacts">
            ${(site.contacts || []).map((contact) => `
              <div class="referring-site-contact">
                <strong>${contact.name}</strong>
                <span>${contact.role || ""}</span>
                ${contact.phone ? `<a href="tel:${contact.phone.replace(/\s/g, "")}">${contact.phone}</a>` : ""}
                ${contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function openReferringSiteOnMap(siteId) {
      const runtime = referringMapRuntime;
      const site = findReferringSiteById(siteId);
      const marker = runtime?.markers?.get(siteId);
      if (!runtime?.map || !runtime.infoWindow || !site || !marker) return;

      runtime.infoWindow.setContent(renderReferringSiteInfoHtml(site));
      runtime.infoWindow.open({ map: runtime.map, anchor: marker });
      if (marker.position) runtime.map.panTo(marker.position);
    }

    function renderReferringMapFallback(message, hint) {
      const hintHtml = hint || 'Nastavte proměnnou prostředí <code>GOOGLE_MAPS_API_KEY</code> a restartujte server.';
      return `
        <div class="referring-map-fallback">
          <strong>Google Maps není k dispozici</strong>
          <p>${message}</p>
          <p class="referring-map-fallback-hint">${hintHtml}</p>
        </div>
      `;
    }

    function showReferringMapAuthError() {
      const container = document.getElementById("referringGoogleMap");
      if (!container) return;
      referringMapRuntime = null;
      container.innerHTML = renderReferringMapFallback(
        "Google Maps odmítlo požadavek (chyba autorizace API klíče).",
        'V <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener">Google Cloud Console</a> povolte <strong>Maps JavaScript API</strong> a aktivujte fakturaci pro daný projekt.'
      );
    }

    window.gm_authFailure = showReferringMapAuthError;

    async function initReferringGoogleMap() {
      const container = document.getElementById("referringGoogleMap");
      if (!container) return;

      referringMapRuntime = null;
      const apiKey = appConfig.googleMapsApiKey;
      if (!apiKey) {
        container.innerHTML = renderReferringMapFallback("Chybí API klíč pro Google Maps.");
        return;
      }

      container.innerHTML = "";

      let mapsLib;
      let markerLib;
      let coreLib;
      try {
        ({ mapsLib, markerLib, coreLib } = await loadGoogleMapsRuntime(apiKey));
      } catch (error) {
        container.innerHTML = renderReferringMapFallback(error.message || "Mapu se nepodařilo načíst.");
        return;
      }

      const liveContainer = document.getElementById("referringGoogleMap");
      if (!liveContainer || liveContainer !== container) return;

      const { Map: GoogleMap, InfoWindow, Polyline } = mapsLib;
      const { AdvancedMarkerElement } = markerLib;
      const { LatLngBounds } = coreLib;

      const centerSite = referringNetwork.center;
      const sites = referringNetwork.sites || [];
      const centerLatLng = centerSite ? getReferringSiteLatLng(centerSite) : null;
      const selectedSiteId = demoState.referringSiteId;

      const map = new GoogleMap(liveContainer, {
        center: centerLatLng || { lat: 49.75, lng: 15.5 },
        zoom: 7,
        mapId: appConfig.googleMapsMapId || "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });

      const infoWindow = new InfoWindow();
      const markers = new Map();
      const polylines = [];

      infoWindow.addListener("closeclick", () => {
        if (!demoState.referringSiteId) return;
        demoState.referringSiteId = null;
        scheduleStateSync();
        render();
      });

      const addMarker = (site, { isCenter = false } = {}) => {
        const position = getReferringSiteLatLng(site);
        if (!position) return;

        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: isCenter ? "FN Motol" : site.city,
          content: createReferringMarkerContent({
            isCenter,
            isSelected: selectedSiteId === site.id
          }),
          gmpClickable: true,
          zIndex: isCenter ? 1000 : site.referrals12m || 1
        });

        marker.addListener("gmp-click", () => {
          demoState.referringSiteId = site.id;
          scheduleStateSync();
          render();
        });

        markers.set(site.id, marker);
      };

      if (centerSite && centerLatLng) {
        sites.forEach((site) => {
          const from = getReferringSiteLatLng(site);
          if (!from) return;
          const polyline = new Polyline({
            path: [from, centerLatLng],
            geodesic: true,
            strokeColor: "#2b6cb0",
            strokeOpacity: referralFlowLineOpacity(site.referrals12m || 0),
            strokeWeight: referralFlowLineWidth(site.referrals12m || 0),
            map
          });
          polylines.push(polyline);
        });
        addMarker(centerSite, { isCenter: true });
      }

      sites.forEach((site) => addMarker(site));

      const bounds = new LatLngBounds();
      [centerSite, ...sites].forEach((site) => {
        const position = site ? getReferringSiteLatLng(site) : null;
        if (position) bounds.extend(position);
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 72, left: 48 });
      }

      referringMapRuntime = { map, infoWindow, markers, polylines };

      if (selectedSiteId) {
        openReferringSiteOnMap(selectedSiteId);
      }
    }

    function initReferringGoogleMapAfterRender() {
      if (demoState.mainTab !== "referringNetwork" || !canAccessReferringNetwork()) return;
      window.requestAnimationFrame(() => {
        void initReferringGoogleMap();
      });
    }

    function selectedOrganOffer() {
      const offerId = demoState.organOfferId;
      if (!offerId) return null;
      return organOffers.find((item) => item.id === offerId) || null;
    }

    function organOfferStatusLabel(status) {
      if (status === "new") return "Nová";
      if (status === "accepted") return "Přijata";
      if (status === "rejected") return "Odmítnuta";
      if (status === "expired") return "Vypršela";
      return status;
    }

    function organOfferStatusClass(status) {
      if (status === "new") return "warn";
      if (status === "accepted") return "ok";
      if (status === "rejected") return "critical";
      return "neutral";
    }

    function isInternalViewer() {
      const user = activeUser();
      return user.roleId === "coordinator" || isClinicalTeamViewer();
    }

    function isSharedWithAmbulatory(file) {
      return getDocumentVisibility(file) === "shared_ambulatory";
    }

    function canManageFlowEvidence() {
      return isInternalViewer();
    }

    function findPatientFlowDocumentBucket(patient, docId) {
      if (!patient?.flowEvidence) return null;
      for (const [bucket, items] of Object.entries(patient.flowEvidence)) {
        const hit = (items || []).some((item) => {
          if (isFlowEvidenceSubmission(item)) {
            return (item.files || []).some((file) => file.id === docId);
          }
          return item.id === docId;
        });
        if (hit) return bucket;
      }
      return null;
    }

    function renderFlowDocumentVisibilityBadges(file) {
      return renderFlowDocumentRoleBadges(file);
    }

    function renderClosureSummaryPanel(patient, bucket) {
      const submissions = getPhaseEvidenceSubmissions(patient, bucket);
      const outbound = findOutboundMessageSubmission(patient, bucket);

      if (!submissions.length) {
        return `
          <div class="flow-closure-summary flow-closure-summary--empty">
            <p><strong>Podklady u fáze:</strong> zatím žádné. Tým je musí vložit během fáze, ne až při uzavření.</p>
          </div>
        `;
      }

      return `
        <div class="flow-closure-summary">
          <p class="flow-closure-summary-lead">Před potvrzením zkontrolujte vložení u aktuální fáze a co odejde pneumologovi.</p>
          <div class="flow-closure-contributions">
            ${renderPhaseContributions(submissions, patient, { compact: true })}
          </div>
          ${outbound ? `
            <p class="flow-closure-outbound-note">
              Pneumologovi odejde vložení od <strong>${escapeHtml(outbound.author)}</strong>
              (${escapeHtml(outbound.note || outbound.files?.[0]?.name || "zpráva pro odesílatele")}).
            </p>
          ` : `
            <p class="flow-closure-outbound-warn">
              Chybí zpráva pro odesílatele. Transplantní pneumolog nebo koordinátor ji musí vložit během fáze jako typ „zpráva pro odesílatele“.
            </p>
          `}
        </div>
      `;
    }

    function filterAttachmentsForViewer(attachments) {
      const files = attachments || [];
      const user = activeUser();
      if (user.roleId === "ambulatory") {
        return files.filter(isSharedWithAmbulatory);
      }
      if (user.roleId === "patient") {
        return [];
      }
      return [...files];
    }

    function dedupeAttachmentsById(attachments) {
      const seen = new Set();
      return (attachments || []).filter((file) => {
        const key = file.id || `${file.name}|${file.date || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getFlowEvidenceBucketFiles(patient, bucket) {
      return dedupeAttachmentsById(
        filterSubmissionsForViewer(getPhaseEvidenceSubmissions(patient, bucket)).flatMap(flattenSubmissionFiles)
      );
    }

    function getUkoncenoFlowEvidence(patient) {
      const fromBucket = getFlowEvidenceBucketFiles(patient, "ukonceno");
      if (fromBucket.length) return fromBucket;
      if (patient.state === "UKONCENO") {
        return getFlowEvidenceBucketFiles(patient, "rozhodnutí");
      }
      return [];
    }

    function getUkoncenoPhaseSubmissions(patient) {
      const fromBucket = getMergedPhaseEvidenceSubmissions(patient, ["ukonceno"]);
      if (fromBucket.length) return fromBucket;
      if (patient.state === "UKONCENO") {
        return getMergedPhaseEvidenceSubmissions(patient, ["rozhodnutí"]);
      }
      return [];
    }

    function findPatientFlowDocument(patient, docId) {
      if (!patient?.flowEvidence) return null;
      for (const items of Object.values(patient.flowEvidence)) {
        for (const item of items || []) {
          if (isFlowEvidenceSubmission(item)) {
            const hit = (item.files || []).find((file) => file.id === docId);
            if (hit) return flattenSubmissionFiles(item).find((file) => file.id === docId);
          } else if (item.id === docId) {
            return normalizeDocumentVisibility(item);
          }
        }
      }
      return null;
    }

    function findPatientFlowSubmission(patient, submissionId) {
      if (!patient?.flowEvidence) return null;
      for (const items of Object.values(patient.flowEvidence)) {
        const hit = (items || []).find((item) => item.id === submissionId);
        if (hit) return hit;
      }
      return null;
    }

    function findPatientForDocument(docId) {
      return patients.find((patient) => {
        if (patient.referral?.attachments?.some((file) => file.id === docId)) return true;
        if (findPatientFlowDocument(patient, docId)) return true;
        if (getReferralChat(patient).some((entry) => (entry.attachments || []).some((file) => file.id === docId))) {
          return true;
        }
        return false;
      });
    }

    function canAmbulatoryViewDocument(docId) {
      const user = activeUser();
      if (user.roleId !== "ambulatory") return true;
      if (ambulatoryDocs[docId]) return true;
      if (ambulatoryMessages.some((message) => (message.attachments || []).some((file) => file.id === docId))) {
        return true;
      }

      const patient = findPatientForDocument(docId);
      if (!patient || patient.referrerId !== user.id) return false;

      if (patient.referral?.attachments?.some((file) => file.id === docId)) return true;
      if (getReferralChat(patient).some((entry) => (entry.attachments || []).some((file) => file.id === docId))) {
        return true;
      }

      const flowDoc = findPatientFlowDocument(patient, docId);
      if (flowDoc) return isSharedWithAmbulatory(flowDoc);

      return false;
    }

    function getFlowEvidenceBucketForPatient(patient) {
      if (patient.state === "PO_TX") return "po_tx";
      if (patient.state === "UKONCENO") return "ukonceno";
      return "rozhodnutí";
    }

    function getFlowEvidenceBucketLabel(patient) {
      const bucket = getFlowEvidenceBucketForPatient(patient);
      if (bucket === "po_tx") return "Po transplantaci";
      if (bucket === "ukonceno") return "Ukončeno";
      if (patient.state === "WL") return "Čekací listina / péče";
      return "Posuzování";
    }

    function getExamContextForPatient(patient) {
      if (patient.state === "PO_TX") return "post_tx";
      if (patient.state === "WL") return "wl_followup";
      if (patient.state === "POSUZOVANI") return "evaluation";
      return "other";
    }

    function normalizeExam(exam, patient, index) {
      return {
        id: exam.id || `${patient.id}-exam-${index}`,
        title: exam.title || "Vyšetření",
        place: exam.place || "-",
        date: exam.date || "-",
        note: exam.note || "",
        status: exam.status || "planned",
        context: exam.context || getExamContextForPatient(patient),
        documentId: exam.documentId || null,
        outputNote: exam.outputNote || "",
        bundle: Boolean(exam.bundle),
        createdAt: exam.createdAt || "",
        createdBy: exam.createdBy || ""
      };
    }

    function getPatientExams(patient) {
      if (!patient?.exams?.length) return [];
      return patient.exams.map((exam, index) => normalizeExam(exam, patient, index));
    }

    function findPatientExamRaw(patient, examId) {
      return patient.exams?.find((exam, index) => normalizeExam(exam, patient, index).id === examId);
    }

    function getPlannedExamsForPatient(patient) {
      return getPatientExams(patient).filter((exam) => exam.status === "planned");
    }

    function getPatientVisiblePlannedExams(patient) {
      return getPlannedExamsForPatient(patient);
    }

    function pushPatientNotification(patientId, message, type = "exam_planned") {
      if (!demoState.patientNotifications) demoState.patientNotifications = [];
      demoState.patientNotifications.unshift({
        id: `pn-${Date.now()}`,
        patientId,
        message,
        type,
        createdAt: formatDemoTimestamp(),
        read: false
      });
    }

    function getUnreadPatientNotifications(patientId) {
      return (demoState.patientNotifications || []).filter((item) => item.patientId === patientId && !item.read);
    }

    function markPatientNotificationsRead(patientId) {
      (demoState.patientNotifications || []).forEach((item) => {
        if (item.patientId === patientId) item.read = true;
      });
    }

    function getStaffVisiblePlannedExams(patient) {
      return getPlannedExamsForPatient(patient);
    }

    function canViewPatientExamPlan(patient) {
      if (!patient || patient.state === "UKONCENO") return false;
      const user = activeUser();
      if (user.roleId === "patient") return true;
      return user.roleId === "coordinator" || isClinicalTeamViewer() || user.roleId === "ambulatory";
    }

    function canManageExams(patient) {
      if (!patient || patient.state === "UKONCENO") return false;
      const user = activeUser();
      return user.roleId === "coordinator" || isClinicalTeamViewer();
    }

    function getActiveFlowStepKey(patient) {
      return buildAmbulatoryFlow(patient).find((step) => step.status === "active")?.key || null;
    }

    function getInternalStaffUsers() {
      return demoUsers.filter((user) => user.roleId !== "patient" && user.roleId !== "ambulatory");
    }

    function getAmbulatoryMentionUsers() {
      return demoUsers.filter((user) => user.roleId === "ambulatory");
    }

    function getInternalChatMessages(patient) {
      return patient?.internalChat || [];
    }

    function getInternalChatSorted(patient) {
      return [...getInternalChatMessages(patient)].sort((a, b) => parseDemoDate(a.createdAt) - parseDemoDate(b.createdAt));
    }

    function getInternalChatParticipants(patient) {
      const ids = new Set();
      getInternalChatMessages(patient).forEach((message) => {
        if (message.authorId) ids.add(message.authorId);
        (message.taggedUserIds || []).forEach((userId) => ids.add(userId));
      });
      return [...ids].map((id) => demoUsers.find((user) => user.id === id)).filter(Boolean);
    }

    function isInternalChatParticipant(patient, userId) {
      if (!userId) return false;
      return getInternalChatParticipants(patient).some((user) => user.id === userId);
    }

    function canViewInternalChat(patient) {
      if (!patient) return false;
      return canViewInternalChatForRole(patient, activeUser().roleId);
    }

    function canAddInternalChat(patient) {
      if (!canViewInternalChat(patient)) return false;
      return patient.state !== "UKONCENO";
    }

    function canViewInternalChatForRole(patient, roleId) {
      if (!patient) return false;
      if (roleId === "coordinator" || clinicalTeamRoles.includes(roleId)) return true;
      return false;
    }

    function getInternalChatReadId(patientId, roleId = activeUser().roleId) {
      return demoState.internalChatRead?.[roleId]?.[patientId] || null;
    }

    function markInternalChatRead(patient, roleId = activeUser().roleId) {
      if (!patient?.id || !canViewInternalChatForRole(patient, roleId)) return;
      const messages = getInternalChatSorted(patient);
      if (!messages.length) return;

      if (!demoState.internalChatRead) demoState.internalChatRead = {};
      if (!demoState.internalChatRead[roleId]) demoState.internalChatRead[roleId] = {};
      demoState.internalChatRead[roleId][patient.id] = messages[messages.length - 1].id;
    }

    function acknowledgePatientChats(patientId = demoState.patientId, roleId = activeUser().roleId) {
      if (!patientId) return;
      const patient = patients.find((item) => item.id === patientId);
      if (!patient) return;

      if (canViewInternalChatForRole(patient, roleId)) {
        markInternalChatRead(patient, roleId);
      }
      if (canUseReferralChat(roleId) && referralWasSent(patient)) {
        markReferralChatRead(patient, roleId);
      }
    }

    function isOwnInternalChatMessage(message, roleId = activeUser().roleId) {
      if (message.authorRole) return message.authorRole === roleId;
      const author = demoUsers.find((user) => user.id === message.authorId);
      return author?.roleId === roleId;
    }

    function getInternalChatUnreadMessages(patient, roleId = activeUser().roleId) {
      if (!canViewInternalChatForRole(patient, roleId)) return [];
      const messages = getInternalChatSorted(patient);
      if (!messages.length) return [];

      const readId = getInternalChatReadId(patient.id, roleId);
      let unread = messages;
      if (readId) {
        const readIndex = messages.findIndex((message) => message.id === readId);
        unread = readIndex >= 0 ? messages.slice(readIndex + 1) : messages;
      }

      return unread.filter((message) => !isOwnInternalChatMessage(message, roleId));
    }

    function getInternalChatUnreadCount(patient, roleId = activeUser().roleId) {
      return getInternalChatUnreadMessages(patient, roleId).length;
    }

    function getInternalChatIndicatorState(patient) {
      const messages = getInternalChatMessages(patient);
      if (!messages.length) return "none";
      const unreadCount = getInternalChatUnreadCount(patient);
      if (unreadCount > 0) return "unread";
      return "active";
    }

    function userInitials(name) {
      const parts = (name || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "?";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    function stripDiacritics(value) {
      return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function renderPatientCommEnvelope(state = "none", unreadCount = 0) {
      if (state === "unread") {
        return `
          <span class="patient-comm-bubble patient-comm-bubble--unread">${renderMonoIcon("communication", "mono-icon patient-comm-bubble-icon")}</span>
          <span class="patient-comm-unread-badge">${unreadCount}</span>
        `;
      }

      if (state === "active") {
        return `<span class="patient-comm-bubble patient-comm-bubble--active">${renderMonoIcon("communication", "mono-icon patient-comm-bubble-icon")}</span>`;
      }

      return `<span class="patient-comm-bubble patient-comm-bubble--none">${renderMonoIcon("communication", "mono-icon patient-comm-bubble-icon")}</span>`;
    }

    function renderPatientCommIndicator(patient) {
      const user = activeUser();
      if (!canViewInternalChat(patient)) {
        if (user.roleId === "ambulatory") {
          const referralUnread = getReferralChatUnreadCount(patient);
          if (referralUnread > 0) {
            const title = referralChatUnreadTitle(referralUnread);
            return `
              <span class="patient-comm-indicator patient-comm-indicator--unread" title="${title}" aria-label="${title}">
                ${renderPatientCommEnvelope("unread", referralUnread)}
              </span>
            `;
          }
          if (getReferralChatSorted(patient).length) {
            return `
              <span class="patient-comm-indicator patient-comm-indicator--active" title="Chat k žádosti probíhá" aria-label="Chat k žádosti probíhá">
                ${renderPatientCommEnvelope("active")}
              </span>
            `;
          }
        }
        return "";
      }

      const state = getInternalChatIndicatorState(patient);
      const unreadCount = getInternalChatUnreadCount(patient);

      if (state === "none") {
        return `
          <span class="patient-comm-indicator patient-comm-indicator--none" title="Bez interní komunikace" aria-label="Bez interní komunikace">
            ${renderPatientCommEnvelope("none")}
          </span>
        `;
      }

      if (state === "active") {
        return `
          <span class="patient-comm-indicator patient-comm-indicator--active" title="Interní komunikace probíhá" aria-label="Interní komunikace probíhá">
            ${renderPatientCommEnvelope("active")}
          </span>
        `;
      }

      return `
        <span class="patient-comm-indicator patient-comm-indicator--unread" title="${unreadCount} nepřečtených zpráv" aria-label="${unreadCount} nepřečtených zpráv">
          ${renderPatientCommEnvelope("unread", unreadCount)}
        </span>
      `;
    }

    function renderChatReadDivider() {
      return `
        <div class="chat-read-divider" role="separator" aria-label="Nové zprávy">
          <span>Nové zprávy</span>
        </div>
      `;
    }

    function renderInternalChatFeedItems(patient) {
      const messages = getInternalChatSorted(patient);
      if (!messages.length) return "";

      const roleId = activeUser().roleId;
      const unreadMessages = getInternalChatUnreadMessages(patient, roleId);
      const firstUnreadId = unreadMessages[0]?.id;
      const firstUnreadIndex = firstUnreadId ? messages.findIndex((message) => message.id === firstUnreadId) : -1;

      return messages.map((message, index) => {
        const divider = index === firstUnreadIndex && firstUnreadIndex >= 0 ? renderChatReadDivider() : "";
        return `${divider}${renderInternalChatMessage(message)}`;
      }).join("");
    }

    function renderInternalChatTaggedNames(taggedUserIds = []) {
      if (!taggedUserIds.length) return "";
      const names = taggedUserIds
        .map((userId) => demoUsers.find((user) => user.id === userId)?.name)
        .filter(Boolean);
      if (!names.length) return "";
      return `<p class="internal-chat-tags">${names.map((name) => `<span class="internal-chat-tag">@${escapeHtml(name)}</span>`).join(" ")}</p>`;
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function renderInternalChatBody(body) {
      let html = escapeHtml(body || "");
      getInternalStaffUsers().forEach((user) => {
        const names = [user.name, ...user.name.split(/\s+/)].filter((item) => item.length > 2);
        names.forEach((name) => {
          const pattern = new RegExp(`@${escapeRegExp(escapeHtml(name))}`, "gi");
          html = html.replace(pattern, (match) => `<span class="internal-chat-mention">${match}</span>`);
        });
      });
      return html;
    }

    function extractTaggedUserIdsFromMessage(message) {
      const normalized = stripDiacritics(message || "").toLowerCase();
      const tagged = new Set();
      getInternalStaffUsers()
        .filter((user) => user.id !== demoState.userId)
        .forEach((user) => {
          const aliases = [
            user.name,
            ...user.name.split(/\s+/).filter((part) => part.length > 2)
          ]
            .map((alias) => stripDiacritics(alias).toLowerCase())
            .filter(Boolean);

          if (aliases.some((alias) => normalized.includes(`@${alias}`))) {
            tagged.add(user.id);
          }
        });
      return [...tagged];
    }

    function internalChatRoleLabel(roleId) {
      const labels = {
        coordinator: "Koordinátor",
        txPulmo: "Transplantační pneumolog",
        surgeon: "Transplantační chirurg",
        intensivist: "Intenzivist",
        psychologist: "Psycholog",
        rehab: "Rehabilitace",
        automation: "Automatické upozornění",
        patient: "Pacient"
      };
      return labels[roleId] || "Člen týmu";
    }

    function isInternalChatSystemMessage(message) {
      return message?.kind === "system" || message?.authorId === "ltxlink-bot";
    }

    function isInternalChatPatientNote(message) {
      return message?.kind === "patient_note" || message?.source === "daily_record";
    }

    function getInternalChatAuthorRole(message) {
      if (message.authorRole) return internalChatRoleLabel(message.authorRole);
      const user = demoUsers.find((item) => item.id === message.authorId);
      return user ? internalChatRoleLabel(user.roleId) : "Člen týmu";
    }

    function renderInternalChatMessage(message) {
      const isSystem = isInternalChatSystemMessage(message);
      const isPatientNote = isInternalChatPatientNote(message);
      const isOwn = !isSystem && !isPatientNote && message.authorId === demoState.userId;
      const authorUser = demoUsers.find((item) => item.id === message.authorId);
      const avatarMarkup = isSystem
        ? `<div class="internal-chat-message-avatar internal-chat-message-avatar--bot" aria-hidden="true">${renderMonoIcon("sparkle", "mono-icon")}</div>`
        : `<img class="internal-chat-message-avatar" src="${authorUser ? getUserAvatarUrl(authorUser) : "/static/img/avatars/default.jpg"}" alt="">`;

      return `
        <article class="internal-chat-message${isOwn ? " own" : ""}${isSystem ? " system" : ""}${isPatientNote ? " patient-note" : ""}">
          ${avatarMarkup}
          <div class="internal-chat-message-content">
            <div class="internal-chat-message-meta">
              <span class="internal-chat-message-author">${escapeHtml(message.author)}</span>
              <span class="internal-chat-message-role">• ${escapeHtml(getInternalChatAuthorRole(message))}</span>
              <time class="internal-chat-message-time">${escapeHtml(message.createdAt)}</time>
            </div>
            ${message.body ? `
              <div class="internal-chat-message-bubble">
                <p>${renderInternalChatBody(message.body)}</p>
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }

    function renderInternalChatComposer(patient) {
      if (!canAddInternalChat(patient)) return "";

      return `
        <div class="internal-chat-composer">
          <textarea id="internalChatInput" rows="3" placeholder="Napište zprávu… použijte @ pro označení kolegy"></textarea>
          <div class="internal-chat-composer-actions">
            <button type="button" class="btn internal-chat-send-btn" id="internalChatApply">
              ${renderMonoIcon("send", "mono-icon internal-chat-send-icon")}
              Odeslat
            </button>
          </div>
        </div>
      `;
    }

    function renderInternalNotesSection(patient) {
      if (!canViewInternalChat(patient)) return "";
      const notes = patient.internalNotes || [];

      return `
        <div class="card internal-notes-card patient-detail-card">
          <div class="internal-notes-header">
            <span class="internal-notes-header-icon" aria-hidden="true">${renderMonoIcon("list")}</span>
            <div>
              <h3>Interní poznámky</h3>
              <p>Rychlé klinické poznámky a důležité postřehy k pacientovi.</p>
            </div>
          </div>
          
          <div class="internal-notes-list">
            ${notes.length ? notes.map(note => `
              <div class="internal-note-item">
                <div class="internal-note-meta">
                  <span class="internal-note-author">${escapeHtml(note.author)}</span>
                  <time class="internal-note-time">${escapeHtml(note.createdAt)}</time>
                </div>
                <div class="internal-note-body">${escapeHtml(note.body)}</div>
              </div>
            `).join("") : '<p class="empty-notes">Zatím žádné poznámky.</p>'}
          </div>

          <div class="internal-notes-composer">
            <input type="text" id="internalNoteInput" placeholder="Přidat rychlou poznámku… (např. ECMO, urgentní, Frailty score, ...)" autocomplete="off">
            <button type="button" class="btn btn-primary btn-compact" id="addInternalNoteBtn">Přidat</button>
          </div>
        </div>
      `;
    }

    function renderInternalChatWorkspace(patient) {
      if (!canViewInternalChat(patient)) return "";

      const messages = getInternalChatSorted(patient);
      const participants = getInternalChatParticipants(patient);
      const participantLabel = participants.length === 1
        ? "1 účastník"
        : `${participants.length} účastníci`;

      return `
        <div class="card internal-chat-card patient-detail-card">
          <div class="internal-chat-header">
            <span class="internal-chat-header-icon" aria-hidden="true">${renderMonoIcon("communication")}</span>
            <div>
              <h3>Interní komunikace</h3>
              <p>Sdílení informací a koordinace mezi členy týmu.</p>
            </div>
          </div>

          ${participants.length ? `
            <div class="internal-chat-participants">
              <span class="internal-chat-participants-label">
                ${renderMonoIcon("participants", "mono-icon internal-chat-participants-icon")}
                ${participantLabel}
              </span>
              <div class="internal-chat-participant-list">
                ${participants.map((user) => `
                  <span class="internal-chat-participant-pill" title="${escapeHtml(user.name)}">
                    <img src="${getUserAvatarUrl(user)}" alt="">
                    <span>${escapeHtml(user.name)}</span>
                    <span class="internal-chat-online-dot" aria-hidden="true"></span>
                  </span>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <div class="internal-chat-feed" id="internalChatFeed">
            ${messages.length
              ? renderInternalChatFeedItems(patient)
              : ""}
          </div>

          ${renderInternalChatComposer(patient)}
        </div>
      `;
    }

    function scrollElementWithinContainer(container, element, { block = "center" } = {}) {
      if (!container || !element) return;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;

      if (block === "start") {
        container.scrollTop = relativeTop;
        return;
      }
      if (block === "end") {
        container.scrollTop = relativeTop - container.clientHeight + element.offsetHeight;
        return;
      }
      container.scrollTop = relativeTop - container.clientHeight / 2 + element.offsetHeight / 2;
    }

    function scrollAppContentToTop() {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    function scrollChatFeedToUnreadOrBottom(feedId) {
      const feed = document.getElementById(feedId);
      if (!feed) return;
      const scroll = () => {
        const divider = feed.querySelector(".chat-read-divider");
        if (divider) {
          scrollElementWithinContainer(feed, divider, { block: "center" });
          return;
        }
        feed.scrollTop = feed.scrollHeight;
      };
      scroll();
      requestAnimationFrame(() => {
        scroll();
        requestAnimationFrame(scroll);
      });
    }

    function scrollInternalChatToBottom() {
      scrollChatFeedToUnreadOrBottom("internalChatFeed");
    }

    function findExamTitleForDocument(patient, file) {
      if (file?.examTitle) return file.examTitle;
      if (!file?.examId || !patient) return null;
      const exam = getPatientExams(patient).find((item) => item.id === file.examId);
      return exam?.title || null;
    }

    function examEditingKey(patientId, examId) {
      return `${patientId}:${examId}`;
    }

    function parseExamEditingKey(key) {
      if (!key) return { patientId: null, examId: null };
      const splitAt = key.indexOf(":");
      if (splitAt < 0) return { patientId: key, examId: null };
      return {
        patientId: key.slice(0, splitAt),
        examId: key.slice(splitAt + 1)
      };
    }

    function isExamRowEditing(patientId, examId) {
      return demoState.examEditingKey === examEditingKey(patientId, examId);
    }

    function renderExamIconButton(action, { patientId, examId, label, extraClass = "" }) {
      const icon = action === "edit" ? "edit" : action === "delete" ? "remove" : action === "save" ? "check" : action === "complete" ? "circleCheck" : "close";
      const attrs = [
        `type="button"`,
        `class="med-icon-btn ${extraClass}"`.trim(),
        `aria-label="${escapeHtml(label)}"`,
        `title="${escapeHtml(label)}"`
      ];
      if (action === "edit") attrs.push(`data-exam-edit="${patientId}"`, `data-exam-id="${examId}"`);
      if (action === "delete") attrs.push(`data-exam-delete="${examId}"`);
      if (action === "save") attrs.push(`data-exam-save="${patientId}"`, `data-exam-id="${examId}"`);
      if (action === "complete") attrs.push(`data-exam-complete-open="${examId}"`);
      if (action === "cancel") attrs.push(`data-exam-cancel="${patientId}"`);
      return `<button ${attrs.join(" ")}>${renderMonoIcon(icon, "mono-icon med-action-icon")}</button>`;
    }

    function renderExamPlanRowView(exam, patient, canEdit) {
      const meta = [exam.date, exam.place].filter((part) => part && part !== "-").join(" · ");
      return `
        <div class="exam-plan-row" data-exam-row-id="${escapeHtml(exam.id)}">
          <div class="exam-plan-row-main">
            <div class="exam-plan-row-title">${escapeHtml(exam.title)}</div>
            <div class="exam-plan-row-meta">${escapeHtml(meta || "-")}</div>
            ${exam.note ? `<div class="exam-plan-row-note">${escapeHtml(exam.note)}</div>` : ""}
          </div>
          ${canEdit ? `
            <div class="exam-plan-row-actions">
              ${renderExamIconButton("complete", { patientId: patient.id, examId: exam.id, label: "Dokončit vyšetření", extraClass: "med-icon-btn--success" })}
              ${renderExamIconButton("edit", { patientId: patient.id, examId: exam.id, label: "Upravit vyšetření" })}
              ${renderExamIconButton("delete", { patientId: patient.id, examId: exam.id, label: "Smazat vyšetření", extraClass: "med-icon-btn--danger" })}
            </div>
          ` : ""}
        </div>
      `;
    }

    function renderExamPlanRowEdit(exam, patient) {
      return `
        <div
          class="exam-plan-row exam-plan-row--editing"
          data-exam-form="${examEditingKey(patient.id, exam.id)}"
          data-exam-row-id="${escapeHtml(exam.id)}"
        >
          <input type="text" data-exam-field="title" value="${escapeHtml(exam.title || "")}" placeholder="Typ vyšetření" aria-label="Typ vyšetření">
          <input type="text" data-exam-field="place" value="${escapeHtml(exam.place === "-" ? "" : exam.place || "")}" placeholder="Místo" aria-label="Místo">
          <input type="datetime-local" data-exam-field="date" value="${escapeHtml(demoDateTimeToInputValue(exam.date))}" aria-label="Datum a čas">
          <input type="text" data-exam-field="note" value="${escapeHtml(exam.note || "")}" placeholder="Poznámka" aria-label="Poznámka">
          <div class="exam-plan-row-actions">
            ${renderExamIconButton("save", { patientId: patient.id, examId: exam.id, label: "Uložit", extraClass: "med-icon-btn--primary" })}
            ${renderExamIconButton("cancel", { patientId: patient.id, examId: exam.id, label: "Zrušit" })}
          </div>
        </div>
      `;
    }

    function renderExamPlanList(patient, canEdit) {
      const planned = getPlannedExamsForPatient(patient);
      const editing = parseExamEditingKey(demoState.examEditingKey);
      const isAddingNew = editing.patientId === patient.id && editing.examId === "new";

      if (!planned.length && !isAddingNew) {
        return `<div class="exam-plan-empty">${canEdit ? "Zatím žádné vyšetření. Přidejte první tlačítkem +." : "Zatím bez naplánovaných vyšetření."}</div>`;
      }

      const rows = [];

      if (isAddingNew) {
        rows.push(renderExamPlanRowEdit(
          { id: "new", title: "", place: "", date: "", note: "" },
          patient
        ));
      }

      planned.forEach((exam) => {
        if (isExamRowEditing(patient.id, exam.id)) {
          rows.push(renderExamPlanRowEdit(exam, patient));
        } else {
          rows.push(renderExamPlanRowView(exam, patient, canEdit));
        }
      });

      return `<div class="exam-plan-list">${rows.join("")}</div>`;
    }

    function renderManagedExamPlanBox(patient, { editable = false } = {}) {
      const canEdit = editable && canManageExams(patient);

      return `
        <div class="card patient-detail-card exam-plan-card">
          <div class="medication-card-head">
            <div>
              ${renderSectionTitleWithHint("Plánovaná vyšetření", "Termíny vidí pacient i odesílající lékař.")}
            </div>
            ${canEdit ? `
              <button
                type="button"
                class="med-icon-btn medication-add-btn"
                data-exam-plan-add="${patient.id}"
                aria-label="Přidat vyšetření"
                title="Přidat vyšetření"
              >+</button>
            ` : ""}
          </div>
          ${renderExamPlanList(patient, canEdit)}
        </div>
      `;
    }

    function renderExamPlanSection(patient) {
      if (!canViewPatientExamPlan(patient)) return "";
      return renderManagedExamPlanBox(patient, { editable: canManageExams(patient) });
    }

    function readExamRowForm(patientId, examId) {
      const row = document.querySelector(`[data-exam-form="${examEditingKey(patientId, examId)}"]`);
      if (!row) return null;
      return {
        title: row.querySelector('[data-exam-field="title"]')?.value.trim() || "",
        place: row.querySelector('[data-exam-field="place"]')?.value.trim() || "",
        date: examDateTimeInputToLabel(row.querySelector('[data-exam-field="date"]')?.value || ""),
        note: row.querySelector('[data-exam-field="note"]')?.value.trim() || ""
      };
    }

    function startExamEdit(patientId, examId) {
      demoState.examEditingKey = examEditingKey(patientId, examId);
      render();
    }

    function startExamAdd(patientId) {
      demoState.examEditingKey = examEditingKey(patientId, "new");
      render();
    }

    function cancelExamEdit() {
      demoState.examEditingKey = null;
      render();
    }

    function saveExamRow(patientId, examId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canManageExams(patient)) return;

      const values = readExamRowForm(patientId, examId);
      if (!values?.title || !values.date) {
        showToast("Vyplňte typ vyšetření a datum.");
        return;
      }

      const user = activeUser();
      const now = formatDemoTimestamp();
      if (!patient.exams) patient.exams = [];

      if (examId === "new") {
        patient.exams.push({
          id: `${patient.id}-exam-${Date.now()}`,
          title: values.title,
          place: values.place || "FN Motol",
          date: values.date,
          note: values.note,
          status: "planned",
          context: getExamContextForPatient(patient),
          createdAt: now,
          createdBy: user.name
        });
        pushPatientNotification(
          patient.id,
          `Nový termín: ${values.title}, ${values.date}, ${values.place || "FN Motol"}.`,
          "exam_planned"
        );
        demoState.audit.unshift(
          `${now} - ${user.name} naplánovala vyšetření u pacienta ${patient.name}: ${values.title}, ${values.date}.`
        );
        showToast("Vyšetření bylo naplánováno.");
      } else {
        const rawExam = findPatientExamRaw(patient, examId);
        if (!rawExam || rawExam.status !== "planned") {
          showToast("Vyšetření nelze upravit.");
          return;
        }
        rawExam.title = values.title;
        rawExam.place = values.place || "FN Motol";
        rawExam.date = values.date;
        rawExam.note = values.note;
        demoState.audit.unshift(
          `${now} - ${user.name} upravila vyšetření u pacienta ${patient.name}: ${values.title}, ${values.date}.`
        );
        showToast("Vyšetření bylo upraveno.");
      }

      touchPatientUpdated(patient, now);
      demoState.examEditingKey = null;
      render();
    }

    function padTwoDigits(value) {
      return String(value).padStart(2, "0");
    }

    function demoDateTimeToInputValue(value) {
      if (!value || value === "-") return "";
      const match = String(value).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (!match) return "";
      const [, day, month, year, hour = "08", minute = "00"] = match;
      return `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}T${padTwoDigits(hour)}:${padTwoDigits(minute)}`;
    }

    function examDateTimeInputToLabel(value) {
      if (!value) return "";
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return value.trim();
      const [, year, month, day, hour, minute] = match;
      return `${Number(day)}. ${Number(month)}. ${year} ${hour}:${minute}`;
    }

    function populateExamCompleteModal(patient, examId) {
      const exam = getPatientExams(patient).find((item) => item.id === examId);
      if (!exam) return;

      const bucketLabel = getFlowEvidenceBucketLabel(patient);
      document.getElementById("examModalTitle").textContent = "Dokončit vyšetření";
      document.getElementById("examModalMeta").textContent =
        `Závěr a příloha se uloží k fázi ${bucketLabel}. Pacient dostane informativní zprávu.`;
      document.getElementById("coordExamCompleteId").value = exam.id;
      document.getElementById("coordExamCompleteHint").textContent =
        `${exam.title} · ${exam.date} · ${exam.place}`;
      document.getElementById("coordExamCompleteNote").value = "";
      setAttachListItems("coordExamCompleteAttachList", []);
    }

    function openExamCompleteModal(examId) {
      const patient = selectedPatient();
      if (!canManageExams(patient)) return;

      demoState.examModalExamId = examId;
      populateExamCompleteModal(patient, examId);
      document.getElementById("coordinatorExamModal").classList.add("open");
      window.setTimeout(() => {
        document.getElementById("coordExamCompleteNote")?.focus();
      }, 120);
    }

    function closeExamModal() {
      document.getElementById("coordinatorExamModal").classList.remove("open");
      demoState.examModalExamId = null;
    }

    function completeExamFromModal() {
      const patient = selectedPatient();
      if (!canManageExams(patient)) return;

      const examId = document.getElementById("coordExamCompleteId")?.value;
      const outputNote = document.getElementById("coordExamCompleteNote")?.value.trim() || "";
      const attachItems = collectAttachListItems("coordExamCompleteAttachList");
      const user = activeUser();
      const now = formatDemoTimestamp();

      if (!examId) {
        showToast("Vyšetření nebylo nalezeno.");
        return;
      }

      if (!outputNote && !attachItems.length) {
        showToast("Vyplňte závěr nebo přiložte dokument.");
        return;
      }

      const rawExam = findPatientExamRaw(patient, examId);
      if (!rawExam || rawExam.status === "done") {
        showToast("Vyšetření nebylo nalezeno nebo už je dokončené.");
        return;
      }

      const bucket = getFlowEvidenceBucketForPatient(patient);
      if (!patient.flowEvidence) patient.flowEvidence = {};
      if (!patient.flowEvidence[bucket]) patient.flowEvidence[bucket] = [];

      const files = attachItems.length
        ? attachItems.map((file, index) => ({
          id: `${patient.id}-exam-out-${Date.now()}-${index}`,
          name: file.name,
          type: file.type,
          size: file.size === "-" ? "142 kB" : file.size
        }))
        : [{
          id: `${patient.id}-exam-out-${Date.now()}`,
          name: `Závěr: ${rawExam.title}`,
          type: "Poznámka",
          size: "-"
        }];

      const submission = createPhaseEvidenceSubmission({
        patient,
        bucket,
        docRole: "supporting",
        note: outputNote || `Výstup vyšetření: ${rawExam.title}`,
        files,
        user,
        now,
        examId,
        examTitle: rawExam.title
      });

      const firstDocId = submission.files[0]?.id || null;

      rawExam.status = "done";
      rawExam.documentId = firstDocId;
      rawExam.outputNote = outputNote;
      rawExam.completedAt = now;

      pushPatientNotification(
        patient.id,
        `Výstup vyšetření „${rawExam.title}“: ${outputNote || "K dispozici je dokument ve vaší péči."}`,
        "exam_result"
      );

      const bucketLabel = getFlowEvidenceBucketLabel(patient);
      demoState.audit.unshift(
        `${now} - ${user.name} dokončila vyšetření „${rawExam.title}" k fázi ${bucketLabel} u pacienta ${patient.name}.`
      );
      touchPatientUpdated(patient, now);
      closeExamModal();
      render();
      openExamCompleteDoneModal(rawExam.title, bucketLabel);
    }

    function deleteCoordinatorExam(examId) {
      const patient = selectedPatient();
      if (!canManageExams(patient)) return;

      const rawExam = findPatientExamRaw(patient, examId);
      if (!rawExam) return;

      const label = rawExam.title || "vyšetření";
      patient.exams = patient.exams.filter((exam, index) => normalizeExam(exam, patient, index).id !== examId);
      const user = activeUser();
      const now = formatDemoTimestamp();
      demoState.audit.unshift(
        `${now} - ${user.name} smazala vyšetření „${label}" u pacienta ${patient.name}.`
      );
      touchPatientUpdated(patient, now);
      if (demoState.examModalExamId === examId) closeExamModal();
      render();
      showToast("Vyšetření bylo smazáno.");
    }

    function dedupePatientFlowEvidence(patient) {
      if (!patient?.flowEvidence) return;
      Object.keys(patient.flowEvidence).forEach((bucket) => {
        const items = dedupeSubmissionsById(patient.flowEvidence[bucket] || []);
        patient.flowEvidence[bucket] = items.map((item) => {
          if (!isFlowEvidenceSubmission(item)) return item;
          return {
            ...item,
            files: dedupeAttachmentsById(item.files || [])
          };
        });
      });
    }

    function wireCoordinatorExamModalOnce() {
      const modal = document.getElementById("coordinatorExamModal");
      if (!modal || modal.dataset.examWired) return;
      modal.dataset.examWired = "1";

      document.getElementById("coordExamComplete")?.addEventListener("click", completeExamFromModal);
    }

    function attachExamPlanSectionEvents() {
      document.querySelectorAll("[data-exam-plan-add]").forEach((button) => {
        button.onclick = () => startExamAdd(button.dataset.examPlanAdd);
      });

      document.querySelectorAll("[data-exam-edit]").forEach((button) => {
        button.onclick = () => startExamEdit(button.dataset.examEdit, button.dataset.examId);
      });

      document.querySelectorAll("[data-exam-save]").forEach((button) => {
        button.onclick = () => saveExamRow(button.dataset.examSave, button.dataset.examId);
      });

      document.querySelectorAll("[data-exam-cancel]").forEach((button) => {
        button.onclick = () => cancelExamEdit();
      });

      document.querySelectorAll("[data-exam-complete-open]").forEach((button) => {
        button.onclick = () => openExamCompleteModal(button.dataset.examCompleteOpen);
      });

      document.querySelectorAll("[data-exam-delete]").forEach((button) => {
        button.onclick = () => deleteCoordinatorExam(button.dataset.examDelete);
      });

      document.querySelectorAll(".exam-plan-row--editing input").forEach((input) => {
        input.onkeydown = (event) => {
          if (event.key !== "Enter") return;
          const form = input.closest("[data-exam-form]");
          if (!form) return;
          const key = form.dataset.examForm || "";
          const { patientId, examId } = parseExamEditingKey(key);
          if (patientId && examId) saveExamRow(patientId, examId);
        };
      });
    }

    function wireExamPlanSectionEvents() {
      attachExamPlanSectionEvents();
    }

    function patientsForAmbulatory() {
      const user = activeUser();
      return patients.filter((patient) => patient.referrerId === user.id);
    }

    function referrerPneumology(patient) {
      if (!patient?.referrer) return "-";
      const parts = patient.referrer.split(",");
      return parts[parts.length - 1].trim() || patient.referrer;
    }

    function formatDemoTimestamp(date = new Date()) {
      return date.toLocaleString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).replace(",", "");
    }

    function formatDemoDateLong() {
      return new Date().toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric"
      });
    }

    function canPatientSubmitDailyRecord(patient) {
      return patient?.state === "WL" || patient?.state === "PO_TX";
    }

    function getPatientMeasurements(patient) {
      return patient?.measurements || [];
    }

    function measurementBpLabel(row) {
      if (row.bp) return row.bp;
      if (row.bpSystolic != null && row.bpDiastolic != null) return `${row.bpSystolic}/${row.bpDiastolic}`;
      if (row.bpSystolic != null) return `${row.bpSystolic}/-`;
      return "-";
    }

    function measurementSymptomsLabel(symptoms) {
      if (!symptoms?.length) return "bez příznaků";
      return symptoms.map((id) => patientDailySymptomLabel[id] || id).join(", ");
    }

    function renderMeasurementSymptomPills(symptoms) {
      if (!symptoms?.length) {
        return '<span class="pill neutral" style="font-size:10px;">bez příznaků</span>';
      }
      return symptoms.map((id) => `
        <span class="pill warn" style="font-size:10px;">${patientDailySymptomLabel[id] || id}</span>
      `).join("");
    }

    function renderPatientDailyRecordForm(patient) {
      if (!canPatientSubmitDailyRecord(patient)) return "";

      const isPostTx = patient.state === "PO_TX";
      const lastRecord = getPatientMeasurements(patient).slice(-1)[0];
      const defaultWeight = lastRecord?.weight != null ? String(lastRecord.weight) : "";

      return `
        <section class="card patient-portal-section patient-daily-record">
          <h2 class="patient-portal-page-title">Dnešní záznam - ${formatDemoDateLong()}</h2>
          <p class="patient-portal-page-sub">${isPostTx
            ? "Domácí spirometrie, vitální funkce a medikace po transplantaci. Data uvidí tým centra i odesílající pneumolog."
            : "Domácí spirometrie a vitální funkce na čekací listině. Tým sleduje trend a reaguje na zhoršení."}</p>

          <form class="daily-record-form" id="patientDailyRecordForm" data-patient-id="${patient.id}">
            <fieldset class="daily-record-fieldset">
              <legend>SPIROMETRIE (domácí přístroj)</legend>
              <div class="field-grid">
                <div class="field">
                  <label for="dailyRecordFev1">FEV1 (l)</label>
                  <input id="dailyRecordFev1" type="number" step="0.01" min="0" placeholder="např. 2.58">
                </div>
                <div class="field">
                  <label for="dailyRecordFvc">FVC (l)</label>
                  <input id="dailyRecordFvc" type="number" step="0.01" min="0" placeholder="např. 3.40">
                </div>
              </div>
            </fieldset>

            <fieldset class="daily-record-fieldset">
              <legend>VITÁLNÍ FUNKCE</legend>
              <div class="field-grid-5 daily-record-vitals">
                <div class="field">
                  <label for="dailyRecordWeight">Hmotnost (kg)</label>
                  <input id="dailyRecordWeight" type="number" step="0.1" min="0" value="${defaultWeight}" placeholder="48">
                </div>
                <div class="field">
                  <label for="dailyRecordBpSys">TK systola</label>
                  <input id="dailyRecordBpSys" type="number" step="1" min="0" placeholder="">
                </div>
                <div class="field">
                  <label for="dailyRecordBpDia">TK diastola</label>
                  <input id="dailyRecordBpDia" type="number" step="1" min="0" placeholder="">
                </div>
                <div class="field">
                  <label for="dailyRecordTemp">Teplota (°C)</label>
                  <input id="dailyRecordTemp" type="number" step="0.1" min="34" max="43" placeholder="">
                </div>
                <div class="field">
                  <label for="dailyRecordSpo2">SpO2 (%)</label>
                  <input id="dailyRecordSpo2" type="number" step="1" min="0" max="100" placeholder="">
                </div>
              </div>
            </fieldset>

            <fieldset class="daily-record-fieldset">
              <legend>NÁLADA (jak se dnes cítíte?)</legend>
              <div class="mood-selection">
                <label class="mood-option">
                  <input type="radio" name="dailyRecordMood" value="1">
                  <div class="mood-option-box">
                    <span class="mood-emoji">😫</span>
                    <span class="mood-label">pod psa</span>
                  </div>
                </label>
                <label class="mood-option">
                  <input type="radio" name="dailyRecordMood" value="2">
                  <div class="mood-option-box">
                    <span class="mood-emoji">😟</span>
                    <span class="mood-label">nic moc</span>
                  </div>
                </label>
                <label class="mood-option">
                  <input type="radio" name="dailyRecordMood" value="3" checked>
                  <div class="mood-option-box">
                    <span class="mood-emoji">😐</span>
                    <span class="mood-label">jde to</span>
                  </div>
                </label>
                <label class="mood-option">
                  <input type="radio" name="dailyRecordMood" value="4">
                  <div class="mood-option-box">
                    <span class="mood-emoji">🙂</span>
                    <span class="mood-label">dobře</span>
                  </div>
                </label>
                <label class="mood-option">
                  <input type="radio" name="dailyRecordMood" value="5">
                  <div class="mood-option-box">
                    <span class="mood-emoji">🤩</span>
                    <span class="mood-label">super</span>
                  </div>
                </label>
              </div>
            </fieldset>

            ${isPostTx ? `
              <fieldset class="daily-record-fieldset">
                <legend>MEDIKACE</legend>
                <label class="daily-record-check">
                  <input id="dailyRecordMedication" type="checkbox" checked>
                  <span>Imunosupresivní medikaci jsem dnes užil/a podle plánu</span>
                </label>
              </fieldset>
            ` : ""}

            <fieldset class="daily-record-fieldset">
              <legend>PŘÍZNAKY (zaškrtněte, pokud se vyskytly)</legend>
              <div class="symptom-tag-list">
                ${patientDailySymptoms.map((symptom) => `
                  <label class="symptom-tag">
                    <input type="checkbox" data-daily-symptom value="${symptom.id}">
                    <span>${symptom.label}</span>
                  </label>
                `).join("")}
              </div>
            </fieldset>

            <fieldset class="daily-record-fieldset">
              <div class="field daily-record-note-field">
                <label for="dailyRecordNote">Doplňující informace k dnešním hodnotám</label>
                <textarea
                  id="dailyRecordNote"
                  rows="3"
                  placeholder="Např. zhoršení dušnosti, otázka na medikaci nebo žádost o kontakt…"
                ></textarea>
              </div>
            </fieldset>

            <div class="daily-record-footer">
              <aside class="daily-record-info">
                <span class="daily-record-info-icon" aria-hidden="true">${renderMonoIcon("info")}</span>
                <p>Tato data jsou informativní. Akutní obtíže řešte standardně - RZP / pohotovost / lékař.</p>
              </aside>
              <button class="btn" type="button" data-submit-daily-record="${patient.id}">Odeslat záznam</button>
            </div>
          </form>
        </section>
      `;
    }

    function renderPatientDailyMood(moodValue) {
      const moodMap = {
        "1": { label: "pod psa", icon: "😫", color: "#0f172a" },
        "2": { label: "nic moc", icon: "😟", color: "#334155" },
        "3": { label: "jde to", icon: "😐", color: "#64748b" },
        "4": { label: "dobře", icon: "🙂", color: "#94a3b8" },
        "5": { label: "super", icon: "🤩", color: "#4f8cff" }
      };
      const mood = moodMap[moodValue];
      if (!mood) return "-";
      return `<span class="mood-pill" style="--mood-color: ${mood.color}" title="${mood.label}">${mood.icon} ${mood.label}</span>`;
    }

    function renderDailyRecordMedicationCell(row, { asPill = true } = {}) {
      if (row.medicationTaken === false) {
        return asPill ? '<span class="pill warn">ne</span>' : "ne";
      }
      if (row.medicationTaken) {
        return asPill ? '<span class="pill ok">ano</span>' : "ano";
      }
      return "-";
    }

    function getDailyRecordKey(row, index) {
      return String(row.id || `${row.recordedAt || row.date || "record"}-${index}`);
    }

    function isDailyRecordExpanded(key) {
      return Boolean(demoState.expandedDailyRecords?.[key]);
    }

    function buildDailyRecordPreview(row) {
      const parts = [];
      if (row.fev1 != null) parts.push(`FEV1 ${Number(row.fev1).toFixed(2)} l`);
      if (row.weight != null) parts.push(`${row.weight} kg`);
      if (row.spo2 != null) parts.push(`SpO2 ${row.spo2} %`);
      if (row.symptoms?.length) parts.push(`${row.symptoms.length} přízn.`);
      return parts.slice(0, 3).join(" · ") || "Domácí záznam";
    }

    function renderDailyRecordField(label, valueHtml) {
      return `
        <div class="daily-record-field">
          <span class="daily-record-field-label">${escapeHtml(label)}</span>
          <span class="daily-record-field-value">${valueHtml}</span>
        </div>
      `;
    }

    function renderDailyRecordEntryBody(row, { showMeds = false, medicationAsPill = true } = {}) {
      const fields = [
        renderDailyRecordField("FEV1", row.fev1 != null ? `${Number(row.fev1).toFixed(2)} l` : "-"),
        renderDailyRecordField("FVC", row.fvc != null ? `${Number(row.fvc).toFixed(2)} l` : "-"),
        renderDailyRecordField("Hmotnost", row.weight != null ? `${row.weight} kg` : "-"),
        renderDailyRecordField("TK", measurementBpLabel(row)),
        renderDailyRecordField("Teplota", row.temp != null ? `${Number(row.temp).toFixed(1)} °C` : "-"),
        renderDailyRecordField("SpO2", row.spo2 != null ? `${row.spo2} %` : "-"),
        renderDailyRecordField("Nálada", renderPatientDailyMood(row.mood))
      ];

      if (showMeds) {
        fields.push(renderDailyRecordField("Medikace", renderDailyRecordMedicationCell(row, { asPill: medicationAsPill })));
      }

      fields.push(renderDailyRecordField(
        "Příznaky",
        `<div class="daily-record-symptom-cell">${renderMeasurementSymptomPills(row.symptoms)}</div>`
      ));

      if (row.note) {
        fields.push(renderDailyRecordField("Poznámka", escapeHtml(row.note)));
      }

      return `<div class="daily-record-fields">${fields.join("")}</div>`;
    }

    function renderDailyRecordsList(patient, records, { medicationAsPill = true } = {}) {
      const showMeds = patient.state === "PO_TX";

      return `
        <div class="daily-records-list">
          ${records.map((row, index) => {
            const key = getDailyRecordKey(row, index);
            const expanded = isDailyRecordExpanded(key);
            return `
              <article class="daily-record-entry${expanded ? " is-open" : ""}">
                <button
                  type="button"
                  class="daily-record-entry-toggle"
                  data-daily-record-toggle="${escapeHtml(key)}"
                  aria-expanded="${expanded ? "true" : "false"}"
                >
                  <span class="daily-record-entry-chevron${expanded ? " is-open" : ""}" aria-hidden="true"></span>
                  <span class="daily-record-entry-main">
                    <strong class="daily-record-entry-date">${escapeHtml(row.recordedAt || row.date || "-")}</strong>
                    <span class="daily-record-entry-preview">${escapeHtml(buildDailyRecordPreview(row))}</span>
                  </span>
                </button>
                <div class="daily-record-entry-body${expanded ? "" : " is-collapsed"}">
                  ${renderDailyRecordEntryBody(row, { showMeds, medicationAsPill })}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `;
    }

    function renderTeamDailyRecordsCard(patient) {
      if (!canPatientSubmitDailyRecord(patient)) return "";

      const records = getPatientMeasurements(patient).slice().reverse();
      const page = getDailyRecordsPage(records);
      const pageRecords = records.slice(
        page * DAILY_RECORDS_PAGE_SIZE,
        (page + 1) * DAILY_RECORDS_PAGE_SIZE
      );

      return `
        <div class="card daily-records-card">
          <div class="card-header">
            <div>
              <h3 class="medication-card-title">Domácí záznamy pacienta</h3>
            </div>
            <div class="card-header-actions">
              <button
                type="button"
                class="daily-records-trends-btn"
                data-open-trends="${patient.id}"
                aria-label="Trendy"
                title="Zobrazit trendy a grafy"
              >
                ${renderMonoIcon("chart", "mono-icon daily-records-ai-icon")}
                <span>Trendy</span>
              </button>
              <button
                type="button"
                class="daily-records-ai-btn"
                data-open-daily-ai="${patient.id}"
                aria-label="AI analýza domácích záznamů"
                title="AI analýza trendů a rizika"
              >
                ${renderMonoIcon("sparkle", "mono-icon daily-records-ai-icon")}
                <span>AI</span>
              </button>
            </div>
          </div>
          ${records.length ? `
            ${renderDailyRecordsList(patient, pageRecords)}
            ${renderDailyRecordsPagination(patient.id, records)}
          ` : '<div class="medication-empty">Zatím nebyl odeslán žádný domácí záznam.</div>'}
        </div>
      `;
    }

    function buildDailyRecordsAiAnalysis(patient) {
      const records = getPatientMeasurements(patient).slice().reverse();
      if (!records.length) {
        return {
          empty: true,
          recordCount: 0
        };
      }

      const fev1Series = records
        .filter((row) => row.fev1 != null)
        .slice()
        .reverse()
        .map((row) => Number(row.fev1));
      const latest = records[0];
      const baseline = patient.baseline != null ? Number(patient.baseline) : fev1Series[0] || null;
      const latestFev1 = latest.fev1 != null ? Number(latest.fev1) : fev1Series[fev1Series.length - 1] || null;

      let fev1DeltaPct = null;
      if (latestFev1 != null && baseline != null && baseline > 0) {
        fev1DeltaPct = ((latestFev1 - baseline) / baseline) * 100;
      } else if (fev1Series.length >= 2) {
        const first = fev1Series[0];
        const last = fev1Series[fev1Series.length - 1];
        if (first > 0) fev1DeltaPct = ((last - first) / first) * 100;
      }

      const symptomEvents = records.filter((row) => row.symptoms?.length).length;
      const criticalSymptoms = records.flatMap((row) => row.symptoms || []).filter((id) =>
        ["hemoptyza", "bolest_hrudi", "horecka"].includes(id)
      ).length;
      const missedMeds = records.filter((row) => row.medicationTaken === false).length;
      const latestSpo2 = latest.spo2 != null ? Number(latest.spo2) : null;
      const moodSeries = records.filter((row) => row.mood != null).slice().reverse().map((row) => Number(row.mood));

      let riskScore = 18;
      if (fev1DeltaPct != null && fev1DeltaPct <= -15) riskScore += 38;
      else if (fev1DeltaPct != null && fev1DeltaPct <= -8) riskScore += 22;
      else if (fev1DeltaPct != null && fev1DeltaPct < 0) riskScore += 10;
      if (latestSpo2 != null && latestSpo2 < 92) riskScore += 28;
      else if (latestSpo2 != null && latestSpo2 < 95) riskScore += 12;
      if (criticalSymptoms) riskScore += 24;
      else if (symptomEvents >= 2) riskScore += 14;
      else if (symptomEvents === 1) riskScore += 8;
      if (missedMeds) riskScore += 16;
      if (latest.mood === "1" || latest.mood === "2") riskScore += 12;
      riskScore = Math.min(96, Math.max(8, Math.round(riskScore)));

      let riskLevel = "stable";
      let riskLabel = "Stabilní profil";
      if (riskScore >= 62) {
        riskLevel = "elevated";
        riskLabel = "Zvýšené riziko";
      } else if (riskScore >= 38) {
        riskLevel = "watch";
        riskLabel = "Sledovat pozorněji";
      }

      const insights = [];
      if (fev1DeltaPct != null) {
        const dir = fev1DeltaPct >= 0 ? "nárůst" : "pokles";
        insights.push({
          tone: fev1DeltaPct <= -10 ? "warn" : fev1DeltaPct < 0 ? "info" : "ok",
          title: "Trend FEV1",
          text: `Oproti referenci ${dir} ${Math.abs(fev1DeltaPct).toFixed(1)} % (aktuálně ${latestFev1?.toFixed(2) || "-"} l).`
        });
      }
      if (latestSpo2 != null) {
        insights.push({
          tone: latestSpo2 < 92 ? "warn" : latestSpo2 < 95 ? "info" : "ok",
          title: "Saturace SpO2",
          text: latestSpo2 < 92
            ? `Poslední hodnota ${latestSpo2} % - pod prahem pro klidovou ventilaci, zvažte telefonický kontakt do 24 h.`
            : latestSpo2 < 95
              ? `Poslední hodnota ${latestSpo2} % - mírně snížená, sledujte trend v dalších záznamech.`
              : `Poslední hodnota ${latestSpo2} % - v obvyklém rozmezí pro domácí monitoring.`
        });
      }
      if (symptomEvents) {
        insights.push({
          tone: criticalSymptoms ? "warn" : "info",
          title: "Subjektivní příznaky",
          text: criticalSymptoms
            ? "V datech jsou závažné příznaky (hemoptýza, horečka nebo bolest na hrudi) - doporučena prioritní klinická evaluace."
            : `Pacient hlásil příznaky u ${symptomEvents} z ${records.length} záznamů; koreluujte se spirometrií a kontaktem.`
        });
      } else {
        insights.push({
          tone: "ok",
          title: "Subjektivní příznaky",
          text: "V analyzovaném okně bez hlášených příznaků - dobrý prognostický signál při stabilní objektivní křivce."
        });
      }
      if (patient.state === "PO_TX" && missedMeds) {
        insights.push({
          tone: "warn",
          title: "Adherence imunosuprese",
          text: `${missedMeds}× neevidované užití medikace - zvýrazněte riziko akutního odmítnutí u koordinátora.`
        });
      }

      if (latest.mood) {
        const moodMap = {
          "1": { label: "pod psa", tone: "warn" },
          "2": { label: "nic moc", tone: "warn" },
          "3": { label: "jde to", tone: "info" },
          "4": { label: "dobře", tone: "ok" },
          "5": { label: "super", tone: "ok" }
        };
        const m = moodMap[latest.mood];
        if (m) {
          insights.push({
            tone: m.tone,
            title: "Subjektivní nálada",
            text: `Pacient hodnotí náladu jako "${m.label}". ${latest.mood <= "2" ? "Výrazně zhoršená nálada může korelovat s fyzickým diskomfortem." : "Dobrá nálada podporuje stabilitu a adherenci."}`
          });
        }
      }

      const actions = [];
      if (riskLevel === "elevated") {
        actions.push("Navrhnout neplánované kontrolní vyšetření do 72 hodin.");
        actions.push("Ověřit domácí techniku spirometrie a správnost měření (3 validní pokusy).");
        actions.push("Informovat transplantní pneumologa - připravit interní chat s odkazem na trend.");
      } else if (riskLevel === "watch") {
        actions.push("Požádat pacienta o denní záznam po dobu 5 dnů místo obvyklého intervalu.");
        actions.push("Porovnat s poslední ambulantní spirometrií v centru.");
      } else {
        actions.push("Pokračovat v standardním režimu domácího monitoringu.");
        actions.push("Při příštím kontaktu potvrdit, že pacient rozumí prahům pro urgentní hlášení.");
      }

      const summary = riskLevel === "elevated"
        ? `Model detekuje signály vyžadující týmovou pozornost u ${patient.name}. Kombinace trendů spirometrie, saturace a příznaků překračuje běžnou variabilitu domácího monitoringu.`
        : riskLevel === "watch"
          ? `Profil ${patient.name} je celkově zvládnutelný, ale některé parametry vykazují mírnou odchylku - vhodná fáze pro preventivní kontakt týmu.`
          : `Domácí data ${patient.name} vypadají stabilně. AI nenašla urgentní vzorec; doporučuje pokračovat v rutinním sledování.`;

      return {
        empty: false,
        recordCount: records.length,
        windowLabel: records.length === 1 ? "1 záznam" : `${records.length} záznamů`,
        riskScore,
        riskLevel,
        riskLabel,
        summary,
        insights,
        actions,
        fev1Series,
        fev1DeltaPct,
        latestLabel: latest.recordedAt || latest.date || "-",
        generatedAt: formatDemoTimestamp()
      };
    }

    function renderAiSparkline(values) {
      if (!values?.length) return "";
      const width = 300;
      const height = 64;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 0.01;
      const points = values.map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - 6 - ((value - min) / range) * (height - 12);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const last = values[values.length - 1];
      const lastX = width;
      const lastY = height - 6 - ((last - min) / range) * (height - 12);

      return `
        <svg class="ai-sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
          <defs>
            <linearGradient id="aiSparkStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#4f8cff"/>
              <stop offset="100%" stop-color="#9b6dff"/>
            </linearGradient>
            <linearGradient id="aiSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(79,140,255,0.22)"/>
              <stop offset="100%" stop-color="rgba(79,140,255,0)"/>
            </linearGradient>
          </defs>
          <polyline points="0,${height} ${points} ${width},${height}" fill="url(#aiSparkFill)" stroke="none"/>
          <polyline points="${points}" fill="none" stroke="url(#aiSparkStroke)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${lastX}" cy="${lastY}" r="4.5" fill="#7b61c7"/>
        </svg>
      `;
    }

    function renderTrendChart({ title, values, labels, color = "#4f8cff", unit = "" }) {
      if (!values?.length) return "";
      const width = 340;
      const height = 120;
      const padding = 25;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const points = values.map((v, i) => {
        const x = padding + (i / Math.max(values.length - 1, 1)) * (width - 2 * padding);
        const y = height - padding - ((v - min) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      return `
        <div class="trend-chart-box">
          <div class="trend-chart-header">
            <strong>${escapeHtml(title)}</strong>
            <span>${values[values.length - 1]}${unit}</span>
          </div>
          <svg viewBox="0 0 ${width} ${height}" class="trend-chart-svg">
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            ${values.map((v, i) => {
              const x = padding + (i / Math.max(values.length - 1, 1)) * (width - 2 * padding);
              const y = height - padding - ((v - min) / range) * (height - 2 * padding);
              return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" />`;
            }).join("")}
          </svg>
          <div class="trend-chart-labels">
            <span>${labels[0]}</span>
            <span>${labels[labels.length - 1]}</span>
          </div>
        </div>
      `;
    }

    function renderPatientTrendsSidebar(patient) {
      const records = getPatientMeasurements(patient).slice().reverse();
      if (!records.length) {
        return `
          <div class="sidebar-panel-header">
            <h3>Trendy a grafy</h3>
            <button class="sidebar-panel-close" data-close-trends>×</button>
          </div>
          <div class="sidebar-panel-content">
            <p class="muted">Žádná data pro zobrazení trendů.</p>
          </div>
        `;
      }

      const labels = records.map(r => r.date || r.recordedAt?.split(" ")[0] || "");
      const fev1Data = records.map(r => Number(r.fev1) || 0);
      const weightData = records.map(r => Number(r.weight) || 0);
      const spo2Data = records.map(r => Number(r.spo2) || 0);
      const moodData = records.map(r => Number(r.mood) || 0);

      return `
        <div class="sidebar-panel-header">
          <div class="sidebar-panel-title-wrap">
            <h3>Trendy pacienta</h3>
            <p>${escapeHtml(patient.name)}</p>
          </div>
          <button class="sidebar-panel-close" data-close-trends>×</button>
        </div>
        <div class="sidebar-panel-content">
          ${renderTrendChart({ title: "FEV1 (Lung Function)", values: fev1Data, labels, color: "#475569", unit: " l" })}
          ${renderTrendChart({ title: "Saturace SpO2", values: spo2Data, labels, color: "#64748b", unit: " %" })}
          ${renderTrendChart({ title: "Hmotnost", values: weightData, labels, color: "#94a3b8", unit: " kg" })}
          ${renderTrendChart({ title: "Nálada (Mood Score)", values: moodData, labels, color: "#1e293b" })}
          
          <div class="trend-info-box">
            <h4>Analytický souhrn</h4>
            <p>Data odrážejí posledních ${records.length} hlášení. Variabilita FEV1 je v normě, nálada pacienta v posledních dnech vykazuje mírný pokles, což může souviset s hlášenou dušností.</p>
          </div>
        </div>
      `;
    }

    function openPatientTrends(patientId) {
      const patient = getPatientById(patientId);
      if (!patient) return;
      const sidebar = document.getElementById("trendsSidebar");
      const container = document.getElementById("trendsSidebarContainer");
      if (!sidebar || !container) return;

      container.innerHTML = renderPatientTrendsSidebar(patient);
      sidebar.classList.add("open");
      sidebar.setAttribute("aria-hidden", "false");
    }

    function closePatientTrends() {
      const sidebar = document.getElementById("trendsSidebar");
      if (sidebar) {
        sidebar.classList.remove("open");
        sidebar.setAttribute("aria-hidden", "true");
      }
    }

    function renderDailyRecordsAiModalContent(patient, analysis) {
      if (analysis.empty) {
        return `
          <div class="ai-insights-drawer">
            <header class="ai-insights-hero ai-insights-hero--compact">
              <div class="ai-insights-hero-glow" aria-hidden="true"></div>
              <div class="ai-insights-hero-top">
                <div class="ai-insights-badge">
                  ${renderMonoIcon("sparkle", "mono-icon ai-insights-badge-icon")}
                  <span>LTxLink AI Insights</span>
                </div>
                <button type="button" class="ai-insights-close" data-close-daily-ai aria-label="Zavřít">×</button>
              </div>
              <h3 id="dailyRecordsAiTitle">Inteligentní analýza domácích záznamů</h3>
            </header>
            <div class="patient-edit-body ai-insights-body">
              <div class="ai-insights-empty">
                <div class="ai-insights-empty-icon">${renderMonoIcon("sparkle", "mono-icon")}</div>
                <h3>Zatím bez dat pro analýzu</h3>
                <p>Až pacient odešle první domácí záznam, AI zde zobrazí trend FEV1, riziko a doporučené kroky týmu.</p>
              </div>
            </div>
          </div>
        `;
      }

      const deltaLabel = analysis.fev1DeltaPct != null
        ? `${analysis.fev1DeltaPct >= 0 ? "+" : ""}${analysis.fev1DeltaPct.toFixed(1)} %`
        : "-";

      return `
        <div class="ai-insights-drawer">
          <header class="ai-insights-hero ai-reveal" style="--ai-delay:0ms">
            <div class="ai-insights-hero-glow" aria-hidden="true"></div>
            <div class="ai-insights-hero-top">
              <div class="ai-insights-badge">
                ${renderMonoIcon("sparkle", "mono-icon ai-insights-badge-icon")}
                <span>LTxLink AI Insights</span>
              </div>
              <button type="button" class="ai-insights-close" data-close-daily-ai aria-label="Zavřít">×</button>
            </div>
            <h3 id="dailyRecordsAiTitle">Inteligentní analýza domácích záznamů</h3>
            <p class="ai-insights-sub" style="color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.5); font-weight: 700;">
              ${escapeHtml(patient.name)} · ${escapeHtml(analysis.windowLabel)} · poslední záznam ${escapeHtml(analysis.latestLabel)}
            </p>
          </header>

          <div class="patient-edit-body ai-insights-body">
            <div class="ai-insights-grid">
              <section class="ai-insights-score ai-reveal ai-insights-score--${analysis.riskLevel}" style="--ai-delay:80ms">
                <div class="ai-insights-score-ring" style="--ai-score:${analysis.riskScore}">
                  <strong>${analysis.riskScore}</strong>
                  <span>skóre rizika</span>
                </div>
                <div>
                  <p class="ai-insights-score-label">${escapeHtml(analysis.riskLabel)}</p>
                  <p class="ai-insights-score-copy">${escapeHtml(analysis.summary)}</p>
                </div>
              </section>

              ${analysis.fev1Series.length >= 2 ? `
                <section class="ai-insights-chart ai-reveal" style="--ai-delay:160ms">
                  <div class="ai-insights-chart-head">
                    <strong>Trend FEV1</strong>
                    <span class="ai-insights-delta ai-insights-delta--${analysis.fev1DeltaPct != null && analysis.fev1DeltaPct < 0 ? "down" : "up"}">${deltaLabel}</span>
                  </div>
                  ${renderAiSparkline(analysis.fev1Series)}
                </section>
              ` : ""}

              <section class="ai-insights-list ai-reveal" style="--ai-delay:240ms">
                <h4>Klíčové signály</h4>
                <div class="ai-insight-cards">
                  ${analysis.insights.map((item, index) => `
                    <article class="ai-insight-card ai-insight-card--${item.tone}" style="--ai-delay:${320 + index * 70}ms">
                      <strong>${escapeHtml(item.title)}</strong>
                      <p>${escapeHtml(item.text)}</p>
                    </article>
                  `).join("")}
                </div>
              </section>

              <section class="ai-insights-actions ai-reveal" style="--ai-delay:520ms">
                <h4>Doporučené kroky týmu</h4>
                <ol class="ai-action-list">
                  ${analysis.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}
                </ol>
              </section>
            </div>
          </div>

          <footer class="patient-edit-footer ai-insights-footer ai-reveal" style="--ai-delay:600ms">
            <span class="ai-insights-pulse" aria-hidden="true"></span>
            Analýza vygenerována ${escapeHtml(analysis.generatedAt)} · podpůrný klinický nástroj, nenahrazuje rozhodnutí lékaře
          </footer>
        </div>
      `;
    }

    function openDailyRecordsAiModal(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient) return;

      const analysis = buildDailyRecordsAiAnalysis(patient);
      const modal = document.getElementById("dailyRecordsAiModal");
      const content = document.getElementById("dailyRecordsAiContent");
      if (!modal || !content) return;

      content.innerHTML = renderDailyRecordsAiModalContent(patient, analysis);
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      syncPageScrollLock();
    }

    function closeDailyRecordsAiModal() {
      const modal = document.getElementById("dailyRecordsAiModal");
      if (!modal || !modal.classList.contains("open")) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      syncPageScrollLock();
    }

    function getPatientPortalUserForPatient(patient) {
      return window.LtxAdmin?.getPatientPortalUser?.(patient)
        || demoUsers.find((user) => user.patientId === patient?.id && user.roleId === "patient");
    }

    function pushDailyRecordNoteToInternalChat(patient, { note, now, measurementId }) {
      const trimmed = String(note || "").trim();
      if (!trimmed || !patient) return;

      const portalUser = getPatientPortalUserForPatient(patient);
      if (!patient.internalChat) patient.internalChat = [];

      patient.internalChat.push({
        id: `${patient.id}-ic-daily-note-${measurementId || Date.now()}`,
        authorId: portalUser?.id || `patient-${patient.id}`,
        author: patient.name,
        authorRole: "patient",
        kind: "patient_note",
        createdAt: now,
        body: `Poznámka k domácímu záznamu:\n${trimmed}`,
        measurementId: measurementId || null,
        source: "daily_record"
      });

      demoState.audit.unshift(
        `${now} - Pacient ${patient.name} přidal poznámku k domácímu záznamu (interní chat týmu).`
      );
    }

    function submitPatientDailyRecord(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canPatientSubmitDailyRecord(patient)) return;

      const parseOptionalNumber = (value) => {
        const trimmed = String(value ?? "").trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      };

      const fev1 = parseOptionalNumber(document.getElementById("dailyRecordFev1")?.value);
      const fvc = parseOptionalNumber(document.getElementById("dailyRecordFvc")?.value);
      const weight = parseOptionalNumber(document.getElementById("dailyRecordWeight")?.value);
      const bpSystolic = parseOptionalNumber(document.getElementById("dailyRecordBpSys")?.value);
      const bpDiastolic = parseOptionalNumber(document.getElementById("dailyRecordBpDia")?.value);
      const temp = parseOptionalNumber(document.getElementById("dailyRecordTemp")?.value);
      const spo2 = parseOptionalNumber(document.getElementById("dailyRecordSpo2")?.value);
      const medicationTaken = patient.state === "PO_TX"
        ? Boolean(document.getElementById("dailyRecordMedication")?.checked)
        : null;
      const mood = document.querySelector('input[name="dailyRecordMood"]:checked')?.value || null;
      const symptoms = Array.from(document.querySelectorAll("[data-daily-symptom]:checked")).map((item) => item.value);
      const note = document.getElementById("dailyRecordNote")?.value.trim() || "";

      if (fev1 == null && fvc == null && weight == null && bpSystolic == null && temp == null && spo2 == null && !symptoms.length && !note) {
        showToast("Vyplňte alespoň jeden parametr, označte příznak nebo doplňte poznámku.");
        return;
      }

      const now = formatDemoTimestamp();
      const dateShort = now.split(/\s+/).slice(0, 2).join(" ");
      if (!patient.measurements) patient.measurements = [];
      const measurementId = `${patient.id}-rec-${Date.now()}`;

      patient.measurements.push({
        id: measurementId,
        recordedAt: now,
        date: dateShort,
        source: "patient",
        fev1,
        fvc,
        weight,
        bpSystolic,
        bpDiastolic,
        temp,
        spo2,
        mood,
        medicationTaken,
        symptoms,
        note: note || null,
        phase: patient.state
      });

      if (note) {
        pushDailyRecordNoteToInternalChat(patient, { note, now, measurementId });
      }

      touchPatientUpdated(patient, now);

      if (symptoms.length) {
        demoState.alerts.unshift({
          id: `a${Date.now()}`,
          patientId: patient.id,
          level: symptoms.some((id) => ["hemoptyza", "bolest_hrudi", "horecka"].includes(id)) ? "varování" : "informativní",
          type: "Domácí záznam - příznaky",
          message: `Pacient označil: ${measurementSymptomsLabel(symptoms)}.${fev1 != null ? ` FEV1 ${fev1.toFixed(2)} l.` : ""}`,
          owner: "Koordinace týmu",
          status: "nový",
          created: "právě teď"
        });
      } else if (patient.state === "PO_TX" && medicationTaken === false) {
        demoState.alerts.unshift({
          id: `a${Date.now()}`,
          patientId: patient.id,
          level: "varování",
          type: "Medikace",
          message: "Pacient u dnešního záznamu uvedl, že neužil/a imunosupresivní medikaci podle plánu.",
          owner: "Transplantační pneumolog",
          status: "nový",
          created: "právě teď"
        });
      }

      demoState.audit.unshift(`${now} - Pacient ${patient.name} odeslal domácí záznam parametrů.${note ? " Včetně poznámky pro tým." : ""}`);
      render();
      showToast(note ? "Dnešní záznam včetně poznámky pro tým byl odeslán." : "Dnešní záznam byl odeslán týmu.");
    }

    function canShowPatientMedications(patient) {
      return patient?.state === "WL" || patient?.state === "PO_TX";
    }

    function shouldShowPatientMedicationsCard(patient, options = {}) {
      const { staffDetail = false } = options;
      if (canShowPatientMedications(patient)) return true;
      return Boolean(staffDetail && isInternalViewer());
    }

    function getPatientMedications(patient) {
      if (!patient) return [];
      if (!patient.medications) patient.medications = [];
      return patient.medications;
    }

    function canEditPatientMedications(patient) {
      return isInternalViewer() && Boolean(patient?.id);
    }

    function medicationEditingKey(patientId, medId) {
      return `${patientId}:${medId}`;
    }

    function parseMedicationEditingKey(key) {
      if (!key) return { patientId: null, medId: null };
      const splitAt = key.indexOf(":");
      if (splitAt < 0) return { patientId: key, medId: null };
      return {
        patientId: key.slice(0, splitAt),
        medId: key.slice(splitAt + 1)
      };
    }

    function isMedicationRowEditing(patientId, medId) {
      return demoState.medicationEditingKey === medicationEditingKey(patientId, medId);
    }

    function renderMedicationIconButton(action, { patientId, medId, label, extraClass = "" }) {
      const icon = action === "edit" ? "edit" : action === "delete" ? "remove" : action === "save" ? "check" : "close";
      const attrs = [
        `type="button"`,
        `class="med-icon-btn ${extraClass}"`.trim(),
        `aria-label="${escapeHtml(label)}"`,
        `title="${escapeHtml(label)}"`
      ];
      if (action === "edit") attrs.push(`data-edit-med="${patientId}"`, `data-med-id="${medId}"`);
      if (action === "delete") attrs.push(`data-delete-med="${patientId}"`, `data-med-id="${medId}"`);
      if (action === "save") attrs.push(`data-save-med="${patientId}"`, `data-med-id="${medId}"`);
      if (action === "cancel") attrs.push(`data-cancel-med="${patientId}"`, `data-med-id="${medId}"`);
      return `<button ${attrs.join(" ")}>${renderMonoIcon(icon, "mono-icon med-action-icon")}</button>`;
    }

    function renderMedicationRowView(med, patient, canEdit) {
      const meta = [med.dose, med.schedule].filter(Boolean).join(" · ") || "-";
      return `
        <div class="medication-row" data-med-row-id="${escapeHtml(med.id)}">
          <div class="medication-row-main">
            <div class="medication-name">${escapeHtml(med.name || "-")}</div>
            <div class="medication-meta">${escapeHtml(meta)}</div>
          </div>
          ${canEdit ? `
            <div class="medication-row-actions">
              ${renderMedicationIconButton("edit", { patientId: patient.id, medId: med.id, label: "Upravit" })}
              ${renderMedicationIconButton("delete", { patientId: patient.id, medId: med.id, label: "Smazat", extraClass: "med-icon-btn--danger" })}
            </div>
          ` : ""}
        </div>
      `;
    }

    function renderMedicationRowEdit(med, patient) {
      return `
        <div
          class="medication-row medication-row--editing"
          data-med-form="${medicationEditingKey(patient.id, med.id)}"
          data-med-row-id="${escapeHtml(med.id)}"
        >
          <input type="text" data-med-field="name" value="${escapeHtml(med.name || "")}" placeholder="Lék" aria-label="Název léku">
          <input type="text" data-med-field="dose" value="${escapeHtml(med.dose || "")}" placeholder="Dávka" aria-label="Dávka">
          <input type="text" data-med-field="schedule" value="${escapeHtml(med.schedule || "")}" placeholder="Schéma" aria-label="Schéma">
          <div class="medication-row-actions">
            ${renderMedicationIconButton("save", { patientId: patient.id, medId: med.id, label: "Uložit", extraClass: "med-icon-btn--primary" })}
            ${renderMedicationIconButton("cancel", { patientId: patient.id, medId: med.id, label: "Zrušit" })}
          </div>
        </div>
      `;
    }

    function renderMedicationList(patient, canEdit) {
      const medications = getPatientMedications(patient);
      const editing = parseMedicationEditingKey(demoState.medicationEditingKey);
      const isAddingNew = editing.patientId === patient.id && editing.medId === "new";

      if (!medications.length && !isAddingNew) {
        return `<div class="medication-empty">${canEdit ? "Zatím žádná medikace. Přidejte první lék tlačítkem +." : "Zatím není zadaná medikace."}</div>`;
      }

      const rows = [];

      if (isAddingNew) {
        rows.push(renderMedicationRowEdit(
          { id: "new", name: "", dose: "", schedule: "" },
          patient
        ));
      }

      medications.forEach((med) => {
        if (isMedicationRowEditing(patient.id, med.id)) {
          rows.push(renderMedicationRowEdit(med, patient));
        } else {
          rows.push(renderMedicationRowView(med, patient, canEdit));
        }
      });

      return `<div class="medication-list">${rows.join("")}</div>`;
    }

    function renderPatientMedicationsCard(patient, options = {}) {
      const { editable = false, staffDetail = false } = options;
      if (!shouldShowPatientMedicationsCard(patient, { staffDetail })) return "";

      const canEdit = editable && canEditPatientMedications(patient);
      const hasStructuredMeds = canShowPatientMedications(patient);
      const referralTreatment = !hasStructuredMeds && patient.referral?.currentTreatment
        ? `
          <div class="medication-referral-note">
            <strong>Současná léčba dle odesílatele</strong>
            <p>${escapeHtml(patient.referral.currentTreatment)}</p>
          </div>
        `
        : "";

      return `
        <div class="card medication-card">
          <div class="medication-card-head">
            <div>
              <h3 class="medication-card-title">Aktuální medikace</h3>
            </div>
            ${canEdit ? `
              <button
                type="button"
                class="med-icon-btn medication-add-btn"
                data-add-medication="${patient.id}"
                aria-label="Přidat lék"
                title="Přidat lék"
              >+</button>
            ` : ""}
          </div>

          ${referralTreatment}

          ${hasStructuredMeds || canEdit
            ? renderMedicationList(patient, canEdit)
            : '<div class="medication-empty">Zatím bez strukturovaného přehledu medikace v centru.</div>'}
        </div>
      `;
    }

    function readMedicationRowForm(patientId, medId) {
      const row = document.querySelector(`[data-med-form="${medicationEditingKey(patientId, medId)}"]`);
      if (!row) return null;
      return {
        name: row.querySelector('[data-med-field="name"]')?.value.trim() || "",
        dose: row.querySelector('[data-med-field="dose"]')?.value.trim() || "",
        schedule: row.querySelector('[data-med-field="schedule"]')?.value.trim() || ""
      };
    }

    function startMedicationEdit(patientId, medId) {
      demoState.medicationEditingKey = medicationEditingKey(patientId, medId);
      render();
    }

    function startMedicationAdd(patientId) {
      demoState.medicationEditingKey = medicationEditingKey(patientId, "new");
      render();
    }

    function cancelMedicationEdit() {
      demoState.medicationEditingKey = null;
      demoState.examEditingKey = null;
      render();
    }

    function saveMedicationRow(patientId, medId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canEditPatientMedications(patient)) return;

      const values = readMedicationRowForm(patientId, medId);
      if (!values || !values.name) {
        showToast("Zadejte název léku.");
        return;
      }

      const medications = getPatientMedications(patient);
      const now = formatDemoTimestamp();
      const user = activeUser();

      if (medId === "new") {
        medications.push({
          id: `med-${Date.now()}`,
          name: values.name,
          dose: values.dose,
          schedule: values.schedule
        });
      } else {
        const med = medications.find((item) => item.id === medId);
        if (!med) return;
        med.name = values.name;
        med.dose = values.dose;
        med.schedule = values.schedule;
      }

      touchPatientUpdated(patient, now);
      demoState.medicationEditingKey = null;
      demoState.examEditingKey = null;
      demoState.audit.unshift(`${now} - ${user.name} aktualizoval medikaci pacienta ${patient.name}.`);
      render();
      showToast("Medikace byla uložena.");
    }

    function deleteMedicationRow(patientId, medId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canEditPatientMedications(patient)) return;

      const medications = getPatientMedications(patient);
      const removed = medications.find((item) => item.id === medId);
      if (!removed) return;

      patient.medications = medications.filter((item) => item.id !== medId);
      const now = formatDemoTimestamp();
      const user = activeUser();
      touchPatientUpdated(patient, now);
      demoState.medicationEditingKey = null;
      demoState.examEditingKey = null;
      demoState.audit.unshift(`${now} - ${user.name} odebral lék „${removed.name}“ u pacienta ${patient.name}.`);
      render();
      showToast("Lék byl odebrán.");
    }

    function attachMedicationRowEvents() {
      document.querySelectorAll("[data-add-medication]").forEach((button) => {
        button.onclick = () => startMedicationAdd(button.dataset.addMedication);
      });

      document.querySelectorAll("[data-edit-med]").forEach((button) => {
        button.onclick = () => startMedicationEdit(button.dataset.editMed, button.dataset.medId);
      });

      document.querySelectorAll("[data-delete-med]").forEach((button) => {
        button.onclick = () => deleteMedicationRow(button.dataset.deleteMed, button.dataset.medId);
      });

      document.querySelectorAll("[data-save-med]").forEach((button) => {
        button.onclick = () => saveMedicationRow(button.dataset.saveMed, button.dataset.medId);
      });

      document.querySelectorAll("[data-cancel-med]").forEach((button) => {
        button.onclick = () => cancelMedicationEdit();
      });

      document.querySelectorAll(".medication-row--editing input").forEach((input) => {
        input.onkeydown = (event) => {
          if (event.key !== "Enter") return;
          const form = input.closest("[data-med-form]");
          if (!form) return;
          const key = form.dataset.medForm || "";
          const { patientId, medId } = parseMedicationEditingKey(key);
          if (patientId && medId) saveMedicationRow(patientId, medId);
        };
      });
    }

    function getReferralChat(patient) {
      return patient?.referral?.thread || [];
    }

    function getReferralChatSorted(patient) {
      return [...getReferralChat(patient)].sort((a, b) => parseDemoDate(a.date) - parseDemoDate(b.date));
    }

    function isChatMessageFromCenter(message) {
      return message.direction === "in";
    }

    function isChatMessageFromOtherParty(message, roleId) {
      if (roleId === "ambulatory") return isChatMessageFromCenter(message);
      if (roleId === "coordinator") return message.direction === "out";
      return false;
    }

    function isOwnReferralChatMessage(message, roleId = activeUser().roleId) {
      return !isChatMessageFromOtherParty(message, roleId);
    }

    function canUseReferralChat(roleId) {
      return roleId === "coordinator" || roleId === "ambulatory";
    }

    function getReferralChatReadId(patientId, roleId = activeUser().roleId) {
      return demoState.referralChatRead?.[roleId]?.[patientId] || null;
    }

    function markReferralChatRead(patient, roleId = activeUser().roleId) {
      if (!patient?.id) return;
      const messages = getReferralChatSorted(patient);
      if (!messages.length) return;

      if (!demoState.referralChatRead) demoState.referralChatRead = {};
      if (!demoState.referralChatRead[roleId]) demoState.referralChatRead[roleId] = {};
      demoState.referralChatRead[roleId][patient.id] = messages[messages.length - 1].id;
    }

    function getReferralChatUnreadMessages(patient, roleId = activeUser().roleId) {
      if (!canUseReferralChat(roleId)) return [];

      const messages = getReferralChatSorted(patient);
      if (!messages.length) return [];

      const readId = getReferralChatReadId(patient.id, roleId);
      let unreadMessages = messages;

      if (readId) {
        const readIndex = messages.findIndex((message) => message.id === readId);
        unreadMessages = readIndex >= 0 ? messages.slice(readIndex + 1) : messages;
      }

      return unreadMessages.filter((message) => isChatMessageFromOtherParty(message, roleId));
    }

    function getReferralChatUnreadCount(patient, roleId = activeUser().roleId) {
      return getReferralChatUnreadMessages(patient, roleId).length;
    }

    function needsReferralChatReply(patient) {
      return getReferralChatUnreadCount(patient) > 0;
    }

    function referralChatUnreadTitle(count = 1) {
      return count === 1 ? "1 nová zpráva v chatu k žádosti" : `${count} nové zprávy v chatu k žádosti`;
    }

    function createChatMessage(patientId, { author, message, direction, attachments = [], date }) {
      return {
        id: `${patientId}-chat-${Date.now()}`,
        direction,
        author,
        date: date || formatDemoTimestamp(),
        message,
        attachments
      };
    }

    function renderReferralChatBubble(message) {
      const side = isChatMessageFromCenter(message) ? "in" : "out";
      const isOwn = isOwnReferralChatMessage(message);
      return `
        <div class="referral-chat-bubble ${side}${isOwn ? " own" : ""}">
          <div class="referral-chat-bubble-meta">
            <strong>${escapeHtml(message.author)}</strong>
            <span>${escapeHtml(message.date)}</span>
          </div>
          <p>${escapeHtml(message.message)}</p>
          ${renderHistoryAttachments(message.attachments)}
        </div>
      `;
    }

    function renderReferralChatFeedItems(patient) {
      const messages = getReferralChatSorted(patient);
      if (!messages.length) return "";

      const roleId = activeUser().roleId;
      const unreadMessages = getReferralChatUnreadMessages(patient, roleId);
      const firstUnreadId = unreadMessages[0]?.id;
      const firstUnreadIndex = firstUnreadId ? messages.findIndex((message) => message.id === firstUnreadId) : -1;

      return messages.map((message, index) => {
        const divider = index === firstUnreadIndex && firstUnreadIndex >= 0 ? renderChatReadDivider() : "";
        return `${divider}${renderReferralChatBubble(message)}`;
      }).join("");
    }

    function renderReferralChatBody(patient, options = {}) {
      const { canChat = canUseReferralChat(activeUser().roleId), messages = getReferralChatSorted(patient), feedId = "referralChatFeed" } = options;

      return `
        <div class="referral-chat-feed" id="${feedId}">
          ${messages.length ? renderReferralChatFeedItems(patient) : `
            <p class="referral-chat-empty">Zatím bez zpráv.</p>
          `}
        </div>
        ${canChat ? `
          <div class="referral-chat-compose">
            <textarea id="referralChatInput" rows="2" placeholder="Doplňte informace k žádosti… použijte @ pro označení ambulantního pneumologa"></textarea>
            <button class="btn btn-compact" type="button" data-send-referral-chat="${patient.id}">Odeslat</button>
          </div>
        ` : ""}
      `;
    }

    function renderReferralChatInline(patient) {
      if (!referralWasSent(patient)) return "";

      const user = activeUser();
      const canChat = canUseReferralChat(user.roleId);
      if (!canChat && user.roleId !== "coordinator") return "";

      const unread = needsReferralChatReply(patient);
      const messages = getReferralChatSorted(patient);

      return `
        <div class="referral-chat-trigger-wrap">
          <button type="button" class="btn ghost btn-compact referral-chat-trigger" data-toggle-referral-chat>
            ${renderMonoIcon("chat", "mono-icon referral-chat-trigger-icon")}
            Chat k žádosti
            ${unread ? `<span class="referral-chat-badge"></span>` : ""}
            ${messages.length ? `<span class="referral-chat-count">(${messages.length})</span>` : ""}
          </button>
        </div>
      `;
    }

    function renderReferralChatSidebar() {
      if (!demoState.referralChatOpen) return "";
      const patient = selectedPatient();
      if (!patient) return "";

      const user = activeUser();
      const canChat = canUseReferralChat(user.roleId);
      const messages = getReferralChatSorted(patient);

      return `
        <div class="referral-chat-sidebar-overlay" data-toggle-referral-chat></div>
        <div class="referral-chat-sidebar">
          <div class="referral-chat-sidebar-header">
            <h3>Chat k žádosti</h3>
            <button type="button" class="referral-chat-close" data-toggle-referral-chat aria-label="Zavřít">
              ${renderMonoIcon("close", "mono-icon")}
            </button>
          </div>
          <div class="referral-chat-sidebar-body">
            <p class="referral-chat-sidebar-hint">Doplňující komunikace s centrem ohledně odeslané žádosti pacienta <strong>${escapeHtml(patient.name)}</strong>.</p>
            ${renderReferralChatBody(patient, { canChat, messages, feedId: "referralChatFeedSidebar" })}
          </div>
        </div>
      `;
    }

    function renderReferralChat(patient) {
      const user = activeUser();
      const canChat = canUseReferralChat(user.roleId);
      const messages = getReferralChatSorted(patient);

      return `
        <div class="card referral-chat-card">
          <div class="card-header">
            <div>
              <h3>Chat k žádosti</h3>
            </div>
          </div>
          ${renderReferralChatBody(patient, { canChat, messages })}
        </div>
      `;
    }

    function scrollReferralChatToBottom() {
      ["referralChatFeed", "referralChatFeedInline"].forEach((feedId) => {
        scrollChatFeedToUnreadOrBottom(feedId);
      });
    }

    function sendReferralChatMessage(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient?.referral) return;

      const user = activeUser();
      if (!canUseReferralChat(user.roleId)) return;

      const message = document.getElementById("referralChatInput")?.value.trim();
      if (!message) {
        showToast("Napište zprávu.");
        return;
      }

      const direction = user.roleId === "ambulatory" ? "out" : "in";
      const now = formatDemoTimestamp();
      if (!patient.referral.thread) patient.referral.thread = [];

      patient.referral.thread.push(createChatMessage(patientId, {
        author: user.name,
        message,
        direction,
        date: now
      }));
      touchPatientUpdated(patient, now);
      demoState.audit.unshift(`${now} - ${user.name} poslal zprávu v chatu k žádosti pacienta ${patient.name}.`);
      markReferralChatRead(patient);
      render();
      showToast("Zpráva byla odeslána.");
    }

    function formatFileSize(bytes) {
      if (!bytes) return "-";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function fileTypeFromName(filename) {
      const ext = (filename.split(".").pop() || "").toLowerCase();
      if (ext === "pdf") return "PDF";
      if (ext === "doc" || ext === "docx") return "DOC";
      if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "IMG";
      return ext ? ext.toUpperCase() : "FILE";
    }

    const FILE_UPLOAD_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";
    const FILE_UPLOAD_DEFAULT_HINT = "PDF, Word, JPEG nebo PNG";

    function renderReferralAttachRowHTML(item) {
      const typeKey = (item.type || "FILE").toLowerCase().replace(/[^a-z0-9]/g, "");
      return `
        <li
          class="file-attach-row"
          role="listitem"
          data-attach-id="${escapeHtml(item.id || "")}"
          data-attach-name="${escapeHtml(item.name)}"
          data-attach-type="${escapeHtml(item.type)}"
          data-attach-size="${escapeHtml(item.size)}"
        >
          <span class="file-chip-icon file-chip-icon--${escapeHtml(typeKey)}" aria-hidden="true">${escapeHtml(item.type)}</span>
          <div class="file-attach-main">
            <span class="file-attach-name">${escapeHtml(item.name)}</span>
            <span class="file-attach-meta">${escapeHtml(item.size)}</span>
          </div>
          <input type="text" class="file-attach-desc" placeholder="Popis přílohy" value="${escapeHtml(item.description || "")}" aria-label="Popis přílohy ${escapeHtml(item.name)}">
          <button type="button" class="file-chip-remove" data-remove-attach aria-label="Odebrat ${escapeHtml(item.name)}">
            <span aria-hidden="true">×</span>
          </button>
        </li>
      `;
    }

    function renderFileChipHTML(item) {
      const typeKey = (item.type || "FILE").toLowerCase().replace(/[^a-z0-9]/g, "");
      return `
        <li
          class="file-chip"
          role="listitem"
          data-attach-id="${escapeHtml(item.id)}"
          data-attach-name="${escapeHtml(item.name)}"
          data-attach-type="${escapeHtml(item.type)}"
          data-attach-size="${escapeHtml(item.size)}"
        >
          <span class="file-chip-icon file-chip-icon--${escapeHtml(typeKey)}" aria-hidden="true">${escapeHtml(item.type)}</span>
          <div class="file-chip-body">
            <span class="file-chip-name">${escapeHtml(item.name)}</span>
            <span class="file-chip-meta">${escapeHtml(item.size)}</span>
          </div>
          <button type="button" class="file-chip-remove" data-remove-attach aria-label="Odebrat ${escapeHtml(item.name)}">
            <span aria-hidden="true">×</span>
          </button>
        </li>
      `;
    }

    function renderFileUpload({ listId, inputId, pickBtnId, items = [], hint, withDescription = false }) {
      const hintText = hint || FILE_UPLOAD_DEFAULT_HINT;
      const renderItem = withDescription ? renderReferralAttachRowHTML : renderFileChipHTML;
      const listClass = withDescription ? "file-upload-list file-upload-list--desc" : "file-upload-list";
      const descAttr = withDescription ? ' data-attach-desc="true"' : "";
      return `
        <div class="file-upload">
          <ul class="${listClass}" id="${listId}" role="list">
            ${items.map((item) => renderItem(item)).join("")}
          </ul>
          <div class="file-upload-actions">
            <button type="button" class="file-upload-add" id="${pickBtnId}" data-attach-pick="${inputId}">
              <span class="file-upload-add-icon" aria-hidden="true">+</span>
              Přidat soubory
            </button>
            <span class="file-upload-hint">${escapeHtml(hintText)}</span>
            <input
              type="file"
              class="file-upload-input"
              id="${inputId}"
              data-attach-list="${listId}"${descAttr}
              multiple
              accept="${FILE_UPLOAD_ACCEPT}"
            >
          </div>
        </div>
      `;
    }

    function renderAttachListItemHTML(item) {
      return renderFileChipHTML(item);
    }

    function renderAttachPicker(options) {
      return renderFileUpload(options);
    }

    function collectAttachListItems(listId, options = {}) {
      const list = document.getElementById(listId);
      if (!list) return [];

      const selector = options.withDescription ? ".file-attach-row" : ".file-chip";
      return Array.from(list.querySelectorAll(selector)).map((element) => ({
        id: element.dataset.attachId || "",
        name: element.dataset.attachName,
        type: element.dataset.attachType || "PDF",
        size: element.dataset.attachSize || "142 kB",
        description: options.withDescription
          ? element.querySelector(".file-attach-desc")?.value.trim() || ""
          : undefined
      }));
    }

    function setAttachListItems(listId, names = []) {
      const list = document.getElementById(listId);
      if (!list) return;

      const items = names.map((name, index) => ({
        id: `attach-${index}-${Date.now()}`,
        name: name.replace(/\.pdf$/i, ""),
        type: "PDF",
        size: "-"
      }));
      list.innerHTML = items.map((item) => renderAttachListItemHTML(item)).join("");
    }

    function addFilesToAttachList(listId, fileList, withDescription = false) {
      const list = document.getElementById(listId);
      if (!list || !fileList?.length) return;

      const renderItem = withDescription ? renderReferralAttachRowHTML : renderFileChipHTML;

      Array.from(fileList).forEach((file, index) => {
        const item = {
          id: `upload-${Date.now()}-${index}`,
          name: file.name.replace(/\.[^.]+$/, "") || file.name,
          type: fileTypeFromName(file.name),
          size: formatFileSize(file.size),
          description: ""
        };
        list.insertAdjacentHTML("beforeend", renderItem(item));
      });
    }

    function initAttachPickerSystemOnce() {
      if (document.documentElement.dataset.attachPickerReady === "1") return;
      document.documentElement.dataset.attachPickerReady = "1";

      document.addEventListener("click", (event) => {
        const pickBtn = event.target.closest("[data-attach-pick]");
        if (!pickBtn) return;
        event.preventDefault();
        const input = document.getElementById(pickBtn.dataset.attachPick);
        input?.click();
      });

      document.addEventListener("change", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
        const listId = input.dataset.attachList;
        if (!listId || !input.files?.length) return;
        addFilesToAttachList(listId, input.files, input.dataset.attachDesc === "true");
        input.value = "";
      });

      document.addEventListener("click", (event) => {
        const removeBtn = event.target.closest("[data-remove-attach]");
        if (!removeBtn) return;
        const row = removeBtn.closest(".file-attach-row");
        if (row) {
          row.remove();
          return;
        }
        removeBtn.closest(".file-chip")?.remove();
      });
    }

    function wirePhaseEvidenceSidebarOnce() {
      const sidebar = document.getElementById("phaseEvidenceSidebar");
      if (!sidebar || sidebar.dataset.phaseEvidenceWired === "1") return;
      sidebar.dataset.phaseEvidenceWired = "1";
      document.getElementById("phaseEvidenceSubmit")?.addEventListener("click", submitPhaseEvidence);
    }

    function renderPathwayPatientPanel(patient, options = {}) {
      const {
        showReferrer = false,
        showReferralEdit = false,
        showCoordinatorFlowTools = false,
        hideSummaryCard = false
      } = options;

      const internalChatSection = canViewInternalChat(patient) ? renderInternalChatWorkspace(patient) : "";
      const detailCommIndicator = hideSummaryCard && canViewInternalChat(patient)
        ? `<span class="patient-detail-comm-indicator">${renderPatientCommIndicator(patient)}</span>`
        : "";

      return `
        <div class="grid">
          ${hideSummaryCard ? "" : `
          <div class="card soft">
            <div class="card-header">
              <div>
                <h3>${patient.name}</h3>
                <p>${patient.diagnosis} · ${patient.city}, ${patient.age} let</p>
                ${showReferrer ? `<p style="margin-top:4px;font-size:13px;color:var(--muted);">Odesílající: ${patient.referrer || "-"}</p>` : ""}
              </div>
              <div class="card-header-side">
                ${showReferralEdit && referralWasSent(patient) ? `
                  <button class="btn ghost btn-compact" type="button" data-amb-edit-referral="${patient.id}">Upravit údaje</button>
                ` : ""}
                <span class="pill ${statePillClass(patient.state)}">${phaseLabel(patient.state)}</span>
              </div>
            </div>
          </div>
          `}
          <div class="card">
            <div class="card-header">
              <div>
                <h3>${hideSummaryCard ? patient.name : "Průběh pacienta"}</h3>
                ${hideSummaryCard ? `<p>${patient.diagnosis} · ${phaseLabel(patient.state)}${showReferrer && patient.referrer ? ` · ${patient.referrer}` : ""}</p>` : ""}
              </div>
              <div class="card-header-side patient-detail-header-side">
                ${detailCommIndicator}
                ${hideSummaryCard ? `<span class="pill ${statePillClass(patient.state)}">${phaseLabel(patient.state)}</span>` : ""}
              </div>
            </div>
            ${renderAmbulatoryFlow(patient, {
              showFlowStateAction: showCoordinatorFlowTools && patient.state !== "UKONCENO" && patient.state !== "PO_TX"
            })}
          </div>
          ${renderExamPlanSection(patient)}
          ${canPatientSubmitDailyRecord(patient) ? renderTeamDailyRecordsCard(patient) : ""}
          ${shouldShowPatientMedicationsCard(patient, { staffDetail: true })
            ? renderPatientMedicationsCard(patient, { editable: canEditPatientMedications(patient), staffDetail: true })
            : ""}
          ${renderInternalNotesSection(patient)}
          ${internalChatSection}
        </div>
      `;
    }

    function coordinatorNextStateOptions(patient) {
      if (patient.state === "POSUZOVANI") {
        return [
          {
            code: "WL",
            label: "Na čekací listině",
            bucket: "rozhodnutí",
            defaultDocs: ["Záznam výroku týmu - zařadit", "Plán péče na WL"],
            defaultNote: "Pacient splňuje indikační kritéria, zařazení na čekací listinu.",
            outcome: "Zařadit na čekací listinu"
          },
          {
            code: "UKONCENO",
            label: "Ukončeno",
            bucket: "ukonceno",
            defaultDocs: ["Záznam výroku týmu - ukončit"],
            defaultNote: "Transplantace v aktuálním stadiu není indikována.",
            outcome: "Nezařazen na čekací listinu"
          }
        ];
      }

      if (patient.state === "WL") {
        return [
          {
            code: "PO_TX",
            label: "Po transplantaci",
            bucket: "po_tx",
            defaultDocs: ["Operační zpráva", "Záznam o výkonu"],
            defaultNote: "Bilaterální transplantace plic proveděna bez závažných komplikací.",
            needsTxDate: true
          },
          {
            code: "UKONCENO",
            label: "Ukončeno",
            bucket: "ukonceno",
            defaultDocs: ["Záznam o ukončení na WL"],
            defaultNote: "Pacient byl odebrán z čekací listiny.",
            outcome: "Ukončeno"
          }
        ];
      }

      return [];
    }

    function getCoordinatorFlowOption(patient, targetCode) {
      return coordinatorNextStateOptions(patient).find((option) => option.code === targetCode);
    }

    function canRecordCoordinatorFlowState(patient) {
      return coordinatorNextStateOptions(patient).length > 0;
    }

    function renderAmbulatoryFlowNextStateStep(patient) {
      if (!canRecordCoordinatorFlowState(patient)) return "";

      const nextNum = buildAmbulatoryFlow(patient).length + 1;

      return `
        <div
          class="amb-flow-step action-pending"
          data-open-coordinator-flow-state="${patient.id}"
          role="button"
          tabindex="0"
          aria-label="Zaznamenat nový stav"
        >
          <div class="amb-flow-num amb-flow-action-circle" aria-hidden="true">${renderMonoIcon("plus", "mono-icon amb-flow-plus-icon")}</div>
          <div class="amb-flow-body amb-flow-action-body">
            <h4>${nextNum}. Uzavřít fázi a odeslat výstup</h4>
            <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.45;">Podklady a zpráva pro odesílatele už musí být u kroku - zde jen potvrdíte uzavření.</p>
          </div>
        </div>
      `;
    }

    function populateCoordinatorFlowStateModal(patient) {
      const options = coordinatorNextStateOptions(patient);
      if (!options.length) return;

      const first = options[0];
      const defaultTxDate = patient.txDate || formatDemoTimestamp().split(/\s+/).slice(0, 2).join(" ");

      document.getElementById("coordinatorFlowStateTitle").textContent = `Uzavřít fázi - ${patient.name}`;
      document.getElementById("coordinatorFlowStateMeta").textContent =
        "Vyberte další stav cesty. Podklady se nepřidávají zde - jen potvrzení výroku a odeslání zprávy pneumologovi.";

      const select = document.getElementById("coordFlowNextState");
      select.innerHTML = options.map((option) => `
        <option value="${option.code}">${escapeHtml(option.label)}</option>
      `).join("");

      document.getElementById("coordFlowNote").value = first.defaultNote || "";
      document.getElementById("coordFlowTxDate").value = defaultTxDate;

      const txField = document.getElementById("coordFlowTxDateField");
      txField.style.display = first.needsTxDate ? "block" : "none";

      updateCoordinatorFlowFormDefaults();
    }

    function openPhaseEvidenceModal(patientId, bucket) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canAddPhaseEvidence(patient)) return;

      demoState.phaseEvidencePatientId = patientId;
      demoState.phaseEvidenceBucket = bucket || getInPhaseEvidenceBucket(patient);

      document.getElementById("phaseEvidenceTitle").textContent = `Nové vložení ke kroku - ${patient.name}`;
      document.getElementById("phaseEvidenceMeta").textContent =
        `Vložení nese autora, čas, poznámku a typ. Více souborů patří k jednomu gestu - typ platí pro celý balíček.`;

      const noteEl = document.getElementById("phaseEvidenceNote");
      if (noteEl) noteEl.value = "";

      setAttachListItems("phaseEvidenceAttachList", []);

      const outboundRadio = document.getElementById("phaseEvidenceRoleOutbound");
      const supportingRadio = document.getElementById("phaseEvidenceRoleSupporting");
      if (supportingRadio) supportingRadio.checked = true;
      if (outboundRadio) {
        outboundRadio.disabled = !canCreateOutboundPhaseMessage();
        outboundRadio.parentElement.style.display = canCreateOutboundPhaseMessage() ? "" : "none";
      }

      document.getElementById("phaseEvidenceSidebar")?.classList.add("open");
      document.getElementById("phaseEvidenceSidebar")?.setAttribute("aria-hidden", "false");
    }

    function closePhaseEvidenceModal() {
      const sidebar = document.getElementById("phaseEvidenceSidebar");
      sidebar?.classList.remove("open");
      sidebar?.setAttribute("aria-hidden", "true");
      demoState.phaseEvidencePatientId = null;
      demoState.phaseEvidenceBucket = null;
    }

    function phaseEvidencePatient() {
      const patientId = demoState.phaseEvidencePatientId || demoState.patientId;
      return patients.find((item) => item.id === patientId) || selectedPatient();
    }

    function submitPhaseEvidence() {
      const patient = phaseEvidencePatient();
      if (!canAddPhaseEvidence(patient)) return;

      const attachItems = collectAttachListItems("phaseEvidenceAttachList");
      const note = document.getElementById("phaseEvidenceNote")?.value.trim() || "";
      if (!attachItems.length) {
        showToast("Přiložte alespoň jeden soubor.");
        return;
      }
      if (!note) {
        showToast("Doplňte krátkou poznámku k vložení.");
        return;
      }

      const docRole = document.getElementById("phaseEvidenceRoleOutbound")?.checked
        ? "outbound_message"
        : "supporting";

      if (docRole === "outbound_message" && !canCreateOutboundPhaseMessage()) {
        showToast("Zprávu pro odesílatele může vložit transplantní tým nebo koordinátor.");
        return;
      }

      const bucket = getPhaseEvidenceUploadBucket(patient, docRole);
      const user = activeUser();
      const now = formatDemoTimestamp();

      createPhaseEvidenceSubmission({
        patient,
        bucket,
        docRole,
        note,
        files: attachItems,
        user,
        now
      });

      demoState.audit.unshift(
        `${now} - ${user.name} vložil(a) ${docRole === "outbound_message" ? "zprávu pro odesílatele" : "interní podklad"} u pacienta ${patient.name}: ${note} (${attachItems.length} souborů).`
      );
      touchPatientUpdated(patient, now);
      closePhaseEvidenceModal();
      render();
      showToast(docRole === "outbound_message"
        ? "Zpráva pro odesílatele byla připojena ke kroku."
        : "Interní podklad byl připojen ke kroku.");
    }

    function openCoordinatorFlowStateModal(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canRecordCoordinatorFlowState(patient)) return;

      demoState.coordinatorFlowPatientId = patientId;
      populateCoordinatorFlowStateModal(patient);
      document.getElementById("coordinatorFlowStateModal").classList.add("open");
    }

    function closeCoordinatorFlowStateModal() {
      document.getElementById("coordinatorFlowStateModal").classList.remove("open");
      demoState.coordinatorFlowPatientId = null;
    }

    function coordinatorFlowPatient() {
      const patientId = demoState.coordinatorFlowPatientId || demoState.patientId;
      return patients.find((item) => item.id === patientId) || selectedPatient();
    }

    function ambulatoryMessagesForUser() {
      const ownIds = patientsForAmbulatory().map((patient) => patient.id);
      return ambulatoryMessages.filter((message) => ownIds.includes(message.patientId));
    }

    function renderReferralAttachments(referral) {
      if (!referral || !referral.attachments) {
        return '<div class="empty">Bez přiložených dokumentů.</div>';
      }

      return `
        <div class="list">
          ${referral.attachments.map((file) => `
            <div class="item">
              <div>
                <h4>${file.name}</h4>
                <p>${file.type} · ${file.size} · ${file.date}</p>
              </div>
              <span class="pill">příloha</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    function parseDemoDate(value) {
      if (!value) return 0;
      const match = String(value).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (!match) return 0;
      const [, day, month, year, hour, minute] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour || 0), Number(minute || 0)).getTime();
    }

    function getPatientUpdatedAt(patient) {
      return patient?.updatedAt || patient?.referral?.updatedAt || "";
    }

    function touchPatientUpdated(patient, now) {
      if (!patient) return;
      const timestamp = now || formatDemoTimestamp();
      patient.updatedAt = timestamp;
      if (patient.referral) patient.referral.updatedAt = timestamp;
    }

    function ensurePatientsUpdatedAt() {
      patients.forEach((patient) => {
        if (!patient.updatedAt && patient.referral?.updatedAt) {
          patient.updatedAt = patient.referral.updatedAt;
        }
      });
    }

    function ensurePatientListUiState() {
      if (!demoState.patientStateFilter) demoState.patientStateFilter = "all";
      if (!demoState.patientListSort) demoState.patientListSort = "updatedAt";
      if (!demoState.patientListSortDir) demoState.patientListSortDir = "desc";
      if (!demoState.patientListSearch) {
        demoState.patientListSearch = "";
      } else if (typeof demoState.patientListSearch !== "string") {
        const legacy = demoState.patientListSearch;
        demoState.patientListSearch = [legacy.name, legacy.diagnosis, legacy.pneumology]
          .filter(Boolean)
          .join(" ")
          .trim();
      }
    }

    function normalizePatientSearchTerm(value) {
      return (value || "").trim().toLowerCase();
    }

    function getPatientListSearchQuery() {
      return normalizePatientSearchTerm(demoState.patientListSearch);
    }

    function patientMatchesListSearch(patient, query) {
      if (!query) return true;
      const haystack = [
        patient.name,
        patient.diagnosisShort,
        patient.diagnosis,
        referrerPneumology(patient),
        patient.referrer
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }

    function filterPatientsBySearch(list) {
      const query = getPatientListSearchQuery();
      if (!query) return list;
      return list.filter((patient) => patientMatchesListSearch(patient, query));
    }

    function filterPatientsByState(list, stateFilter) {
      if (!stateFilter || stateFilter === "all") return list;
      return list.filter((patient) => patient.state === stateFilter);
    }

    function sortPatientList(list) {
      const sortKey = demoState.patientListSort || "updatedAt";
      const sortDir = demoState.patientListSortDir || "desc";
      const direction = sortDir === "asc" ? 1 : -1;

      return [...list].sort((left, right) => {
        if (sortKey === "updatedAt") {
          return (parseDemoDate(getPatientUpdatedAt(left)) - parseDemoDate(getPatientUpdatedAt(right))) * direction;
        }
        if (sortKey === "name") {
          return left.name.localeCompare(right.name, "cs") * direction;
        }
        return 0;
      });
    }

    function preparePatientList(sourcePatients) {
      return sortPatientList(
        filterPatientsBySearch(filterPatientsByState(sourcePatients, demoState.patientStateFilter))
      );
    }

    function renderPatientListToolbar() {
      const active = demoState.patientStateFilter || "all";
      const searchQuery = typeof demoState.patientListSearch === "string" ? demoState.patientListSearch : "";

      return `
        <div class="patient-list-toolbar">
          <div class="patient-state-filters" role="group" aria-label="Filtr podle stavu">
            <button type="button" class="patient-state-filter ${active === "all" ? "active" : ""}" data-patient-state-filter="all">Vše</button>
            ${phases.map((phase) => `
              <button type="button" class="patient-state-filter ${active === phase.code ? "active" : ""}" data-patient-state-filter="${phase.code}">
                ${phase.label}
              </button>
            `).join("")}
          </div>
          <input
            type="search"
            class="patient-list-search"
            data-patient-list-search
            placeholder="Hledat jméno, diagnózu, ..."
            value="${escapeHtml(searchQuery)}"
            aria-label="Hledat v přehledu pacientů"
          >
        </div>
      `;
    }

    function renderPatientListSortHeader(label, sortKey) {
      const activeKey = demoState.patientListSort || "updatedAt";
      const sortDir = demoState.patientListSortDir || "desc";
      const isActive = activeKey === sortKey;
      const indicator = isActive ? (sortDir === "desc" ? " ↓" : " ↑") : "";

      return `
        <button type="button" class="table-sort-btn${isActive ? " active" : ""}" data-patient-sort="${sortKey}">
          ${label}${indicator}
        </button>
      `;
    }

    function renderPatientOverviewRow(item, selectedPatient, options = {}) {
      const { showPneumology = false } = options;
      const canEditDemographics = canEditPatientDemographics(item);

      return `
        <tr class="patient-row ${item.id === selectedPatient.id ? "selected" : ""}" data-select-patient="${item.id}" tabindex="0" role="button" aria-pressed="${item.id === selectedPatient.id}">
          <td>
            <div class="patient-row-name">
              <strong>${item.name}</strong>
              ${canEditDemographics ? `
                <button
                  type="button"
                  class="patient-row-edit-btn"
                  data-edit-patient-demographics="${item.id}"
                  title="Upravit údaje pacienta"
                  aria-label="Upravit údaje pacienta ${item.name}"
                >${renderMonoIcon("edit", "mono-icon patient-row-edit-icon")}</button>
              ` : ""}
            </div>
            <br><span style="color:var(--muted);font-size:12px;">${item.city}, ${item.age} let</span>
          </td>
          <td>${item.diagnosisShort}</td>
          ${showPneumology ? `<td>${referrerPneumology(item)}</td>` : ""}
          <td><span class="pill ${statePillClass(item.state)}">${phaseLabel(item.state)}</span></td>
          <td>${getPatientUpdatedAt(item) || "-"}</td>
          <td class="patient-comm-cell">${renderPatientCommIndicator(item)}</td>
        </tr>
      `;
    }

    function referralWasSent(patient) {
      if (patient.referral?.sentDate) return true;
      const odeslaniStep = patient.evaluationSteps?.find((step) => /odeslání/i.test(step.label));
      if (odeslaniStep?.done) return true;
      return ["POSUZOVANI", "WL", "PO_TX", "UKONCENO"].includes(patient.state);
    }

    function referralSentDateLabel(patient) {
      if (patient.referral?.sentDate) return patient.referral.sentDate;
      const odeslaniStep = patient.evaluationSteps?.find((step) => /odeslání/i.test(step.label) && step.done);
      if (odeslaniStep?.date) return odeslaniStep.date;
      if (patient.referral?.updatedAt) {
        return patient.referral.updatedAt.split(/\s+/).slice(0, 2).join(" ");
      }
      return null;
    }

    function patientHadWaitlistPhase(patient) {
      if (patient.state === "WL" || patient.state === "PO_TX") return true;
      if ((patient.waitDays || 0) > 0) return true;
      const outcome = patient.teamDecision?.outcome || "";
      // Nesmí obsahovat "nezařazen" nebo "zamítnut"
      if (/nezařazen|zamítnut|nepřijat/i.test(outcome)) return false;
      if (/zařadit|čekací listin/i.test(outcome)) return true;
      if (patient.state === "UKONCENO" && /odebrán|čekací listin/i.test(patient.terminationReason || "")) {
        // Opět kontrola na negativní případ
        if (/nezařazen/i.test(patient.terminationReason || "")) return false;
        return true;
      }
      return false;
    }

    function buildReferralStepSubmissions(patient) {
      const attachments = patient.referral?.attachments || [];
      if (!attachments.length) return [];

      const referrerId = patient.referrerId || "u-amb";
      const referrerUser = demoUsers.find((user) => user.id === referrerId);
      const authorName = referrerUser?.name || patient.referrer?.split(",")[0]?.trim() || "Odesílající lékař";
      const sentAt = patient.referral?.updatedAt || patient.referral?.sentDate || "";
      const createdAt = sentAt.includes(":") ? sentAt : (sentAt ? `${sentAt} v 09:00` : "-");

      return [{
        id: `${patient.id}-referral-sub`,
        authorId: referrerId,
        author: authorName,
        createdAt,
        note: "",
        docRole: "from_referrer",
        files: attachments.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          date: file.date || file.addedAt
        }))
      }];
    }

    function buildAmbulatoryFlow(patient) {
      const sentDate = referralSentDateLabel(patient);
      const wasSent = referralWasSent(patient);

      const step1 = {
        key: "odeslání",
        num: 1,
        title: "Odeslání žádosti",
        status: wasSent ? "done" : "pending",
        date: sentDate || null,
        detail: wasSent
          ? sentDate
            ? `Žádost odeslána do FN Motol dne ${sentDate}.`
            : "Žádost odeslána do FN Motol."
          : "Žádost zatím nebyla odeslána.",
        note: null,
        submissions: wasSent ? buildReferralStepSubmissions(patient) : []
      };

      const stepPosuzovani = {
        key: "posuzování",
        num: 2,
        title: "V posuzování",
        status: "pending",
        date: null,
        detail: wasSent
          ? "Centrum pacienta posuzuje."
          : "Posuzování začne po odeslání žádosti.",
        attachments: []
      };

      if (patient.state === "POSUZOVANI") {
        stepPosuzovani.status = "active";
        stepPosuzovani.detail = "Pacient je v posuzování v transplantním centru.";
        stepPosuzovani.submissions = isInternalViewer()
          ? getPhaseEvidenceSubmissions(patient, "rozhodnutí")
          : filterSubmissionsForViewer(getPhaseEvidenceSubmissions(patient, "rozhodnutí"));
      } else if (wasSent) {
        stepPosuzovani.status = "done";
        stepPosuzovani.detail = "Posuzování v centru bylo dokončeno nebo pacient postoupil do další fáze cesty.";
      }

      const steps = [step1, stepPosuzovani];
      let stepNum = 3;

      if (patientHadWaitlistPhase(patient)) {
        const wlSubmissions = isInternalViewer()
          ? getMergedPhaseEvidenceSubmissions(patient, ["rozhodnutí", ...(patient.state === "WL" ? ["po_tx"] : [])], { viewerScoped: false })
          : getMergedPhaseEvidenceSubmissions(patient, ["rozhodnutí", ...(patient.state === "WL" ? ["po_tx"] : [])]);
        steps.push({
          key: "wl",
          num: stepNum,
          title: "Na čekací listině",
          status: patient.state === "WL" ? "active" : "done",
          date: patient.teamDecision?.date,
          detail: patient.teamDecision?.outcome || "Zařazen na čekací listinu",
          note: patient.teamDecision?.note,
          submissions: wlSubmissions
        });
        stepNum += 1;
      }

      if (patient.state === "PO_TX") {
        steps.push({
          key: "po_tx",
          num: stepNum,
          title: "Po transplantaci",
          status: "done",
          date: patient.txDate,
          detail: patient.txDate
            ? `Transplantace proběhla ${patient.txDate}. Pacient je ve sledování po transplantaci.`
            : "Pacient je ve sledování po transplantaci.",
          submissions: getMergedPhaseEvidenceSubmissions(patient, ["po_tx"])
        });
      }

      if (patient.state === "UKONCENO") {
        steps.push({
          key: "ukonceno",
          num: stepNum,
          title: "Ukončeno",
          status: "done",
          date: patient.teamDecision?.date,
          detail: patient.teamDecision?.outcome || patient.terminationReason || "Posuzování ukončeno",
          note: patient.teamDecision?.note,
          submissions: getUkoncenoPhaseSubmissions(patient)
        });
      }

      return steps;
    }

    function ambFlowStepPill(step) {
      if (step.status === "done") {
        if (step.key === "ukonceno") return "neutral";
        if (step.key === "wl") return "warn";
        if (step.key === "po_tx") return "ok";
        return "ok";
      }
      if (step.status === "active") {
        if (step.key === "wl") return "warn";
        if (step.key === "posuzování") return "info";
        return "info";
      }
      return "";
    }

    function ambFlowStepLabel(step) {
      if (step.key === "odeslání" && step.status === "done") return "Odesláno";
      if (step.key === "posuzování" && step.status === "active") return "V posuzování";
      if (step.key === "posuzování" && step.status === "done") return "Posuzování dokončeno";
      if (step.key === "wl") return "Na čekací listině";
      if (step.key === "ukonceno") return "Ukončeno";
      if (step.key === "po_tx" && step.status === "done") return "Po transplantaci";
      if (step.status === "na") return "Nepatří";
      if (step.status === "active") return "Probíhá";
      return "Čeká";
    }

    function renderAmbulatoryFlow(patient, compactOrOptions = false) {
      const options = typeof compactOrOptions === "object" ? compactOrOptions : { compact: compactOrOptions };
      const {
        compact = false,
        showFlowStateAction = false
      } = options;
      const steps = buildAmbulatoryFlow(patient);

      if (compact) {
        return `
          <div class="amb-flow-mini">
            ${steps.map((step) => `
              <span class="${step.status}">${step.num}. ${ambFlowStepLabel(step)}</span>
            `).join("")}
          </div>
        `;
      }

      return `
        <div class="amb-flow">
          ${steps.map((step) => `
            <div class="amb-flow-step ${step.status}">
              <div class="amb-flow-num">${step.num}</div>
              <div class="amb-flow-body">
                <h4>${step.num}. ${step.title}</h4>
                <div class="amb-flow-meta">
                  <span class="pill ${ambFlowStepPill(step)}">${ambFlowStepLabel(step)}</span>
                  ${step.date ? `<span>${step.date}</span>` : ""}
                </div>
                <p style="margin:0;font-size:13px;color:var(--text);line-height:1.45;">${step.detail}</p>
                ${step.note && step.note !== step.detail ? `<p style="margin:6px 0 0;font-size:13px;color:var(--muted);">${step.note}</p>` : ""}
                ${step.submissions?.length ? renderPhaseContributions(step.submissions, patient) : ""}
                ${step.status === "active" && canAddPhaseEvidence(patient) ? `
                  <div class="flow-phase-actions">
                    <button
                      type="button"
                      class="btn ghost btn-compact"
                      data-open-phase-evidence="${patient.id}"
                      data-phase-bucket="${getPhaseEvidenceBucketForStep(step.key, patient)}"
                    >+ Přidat podklad ke kroku</button>
                  </div>
                ` : ""}
                ${step.key === "odeslání" && referralWasSent(patient) ? renderReferralChatInline(patient) : ""}
              </div>
            </div>
          `).join("")}
          ${showFlowStateAction ? renderAmbulatoryFlowNextStateStep(patient) : ""}
        </div>
      `;
    }


    function sanitizeDownloadFileName(name) {
      return String(name || "dokument").replace(/[<>:"/\\|?*]+/g, "_").trim() || "dokument";
    }

    function ensureDownloadExtension(fileName, fileType) {
      const base = sanitizeDownloadFileName(fileName);
      if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
      const type = String(fileType || "PDF").toUpperCase();
      if (type.includes("PDF")) return `${base}.pdf`;
      if (type.includes("DOC")) return `${base}.doc`;
      if (type.includes("PNG")) return `${base}.png`;
      if (type.includes("JPG") || type.includes("JPEG")) return `${base}.jpg`;
      return base;
    }

    function triggerFileDownload(fileName, fileType) {
      const downloadName = ensureDownloadExtension(fileName, fileType);
      
      // Pro PDF dokumenty v demu použijeme reálně vygenerované dummy soubory
      let sourceUrl = null;
      if (fileType === "PDF" || downloadName.toLowerCase().endsWith(".pdf")) {
        const nameLower = downloadName.toLowerCase();
        if (nameLower.includes("spiro")) sourceUrl = "static/docs/spirometrie_260626.pdf";
        else if (nameLower.includes("lab")) sourceUrl = "static/docs/lab_vysledky_260626.pdf";
        else if (nameLower.includes("zprava") || nameLower.includes("odesil")) sourceUrl = "static/docs/zprava_pro_odesilatele_260626.pdf";
        else if (nameLower.includes("rodin") || nameLower.includes("pruvodce")) sourceUrl = "static/docs/pruvodce_pro_rodinu.pdf";
        else if (nameLower.includes("cvic") || nameLower.includes("plan_pece") || nameLower.includes("plán péče")) sourceUrl = "static/docs/plan_pece.pdf";
        else if (nameLower.includes("domaci") || nameLower.includes("domácí")) sourceUrl = "static/docs/domaci_cvicebni_plan.pdf";
        else if (nameLower.includes("vyrok") || nameLower.includes("výrok")) sourceUrl = "static/docs/vyrok_tymu.pdf";
        else if (nameLower.includes("nutri")) sourceUrl = "static/docs/nutricni_zprava.pdf";
        else if (nameLower.includes("psych")) sourceUrl = "static/docs/psychologicke_doporuceni.pdf";
        else sourceUrl = "static/docs/general_medical.pdf";
      }

      if (sourceUrl) {
        const link = document.createElement("a");
        link.href = sourceUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const blob = new Blob(
          [`Soubor ${downloadName} (demo LTx Pathway).\n`],
          { type: "application/octet-stream" }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    }

    function resolveClinicalDocument(docId) {
      if (!docId) return null;

      const catalog = ambulatoryDocs[docId];
      if (catalog?.previewTitle) {
        return { id: docId, name: catalog.previewTitle, type: "PDF" };
      }

      const patient = findPatientForDocument(docId);
      const fromReferral = patient?.referral?.attachments?.find((file) => file.id === docId);
      if (fromReferral) {
        return { id: docId, name: fromReferral.name, type: fromReferral.type };
      }

      const fromFlow = patient ? findPatientFlowDocument(patient, docId) : null;
      if (fromFlow) {
        return { id: docId, name: fromFlow.name, type: fromFlow.type };
      }

      for (const message of ambulatoryMessages) {
        const hit = (message.attachments || []).find((file) => file.id === docId);
        if (hit) return { id: docId, name: hit.name, type: hit.type };
      }

      for (const patientItem of patients) {
        for (const entry of getReferralChat(patientItem)) {
          const hit = (entry.attachments || []).find((file) => file.id === docId);
          if (hit) return { id: docId, name: hit.name, type: hit.type };
        }
      }

      const shared = window.LtxAdmin?.getSharedMaterials?.() || {};
      for (const category of ["psych", "rehab"]) {
        for (const material of shared[category] || []) {
          const hit = (material.attachments || []).find((file) => file.id === docId);
          if (hit) return { id: docId, name: hit.name, type: hit.type };
        }
      }

      return { id: docId, name: docId, type: "PDF" };
    }

    function downloadClinicalDocument(docId) {
      if (!canAmbulatoryViewDocument(docId)) {
        showToast("Tento dokument není k dispozici ke stažení.");
        return;
      }

      const doc = resolveClinicalDocument(docId);
      if (!doc) return;

      triggerFileDownload(doc.name, doc.type);
      showToast(`Stahuje se ${ensureDownloadExtension(doc.name, doc.type)}…`);
    }

    function downloadClinicalFileList(files) {
      if (!files?.length) return;
      files.forEach((file, index) => {
        window.setTimeout(() => downloadClinicalDocument(file.id || file.name), index * 250);
      });
    }

    function resolveContributionAuthor(submission) {
      if (!submission) return null;
      if (typeof submission === "string") {
        return demoUsers.find((user) => user.name === submission) || null;
      }
      if (submission.authorId) {
        return demoUsers.find((user) => user.id === submission.authorId) || null;
      }
      if (submission.author) {
        return demoUsers.find((user) => user.name === submission.author) || null;
      }
      return null;
    }

    function renderAuthorAvatar(submissionOrName) {
      const isObject = submissionOrName && typeof submissionOrName === "object";
      const name = isObject ? (submissionOrName.author || "Tým centra") : (submissionOrName || "Tým");
      const user = resolveContributionAuthor(isObject ? submissionOrName : { author: name });
      const initials = userInitials(name);

      if (user) {
        const url = getUserAvatarUrl(user);
        return `
          <span class="contrib-avatar-wrap" aria-hidden="true">
            <img
              class="contrib-avatar contrib-avatar-photo"
              src="${url}"
              alt=""
              loading="lazy"
              onerror="this.classList.add('is-hidden');this.nextElementSibling.classList.remove('is-hidden');"
            >
            <span class="contrib-avatar contrib-avatar-fallback is-hidden">${escapeHtml(initials)}</span>
          </span>
        `;
      }

      return `<span class="contrib-avatar contrib-avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>`;
    }

    function renderSubmissionVisibilityIcon(docRole) {
      if (docRole === "from_referrer") {
        return `
          <span
            class="contrib-vis-icon contrib-vis-icon--public"
            title="Podklady od odesílajícího lékaře"
            aria-label="Podklady od odesílajícího lékaře"
          >${renderMonoIcon("globe", "mono-icon contrib-vis-icon-svg")}</span>
        `;
      }
      if (docRole === "outbound_message") {
        return `
          <span
            class="contrib-vis-icon contrib-vis-icon--public"
            title="Sdíleno s odesílajícím pneumologem"
            aria-label="Sdílený dokument pro odesílatele"
          >${renderMonoIcon("globe", "mono-icon contrib-vis-icon-svg")}</span>
        `;
      }
      return `
        <span
          class="contrib-vis-icon contrib-vis-icon--internal"
          title="Interní podklad - vidí jen tým centra"
          aria-label="Interní dokument"
        >${renderMonoIcon("lock", "mono-icon contrib-vis-icon-svg")}</span>
      `;
    }

    function getContributionBundleStats(submissions) {
      const files = (submissions || []).flatMap((item) => item.files || []);
      const bytes = files.reduce((sum, file) => sum + parseFileSizeBytes(file.size), 0);
      return {
        submissionCount: (submissions || []).length,
        fileCount: files.length,
        totalSize: formatContributionTotalSize(files),
        totalBytes: bytes
      };
    }

    function formatContributionTimestamp(createdAt) {
      if (!createdAt) return "-";
      return String(createdAt).replace(",", "");
    }

    function parseFileSizeBytes(size) {
      const match = String(size || "").match(/([\d.,]+)\s*(kB|MB|GB|-|-)?/i);
      if (!match) return 0;
      const value = Number(String(match[1]).replace(",", "."));
      if (!Number.isFinite(value)) return 0;
      const unit = String(match[2] || "kB").toLowerCase();
      if (unit === "mb") return value * 1024 * 1024;
      if (unit === "gb") return value * 1024 * 1024 * 1024;
      return value * 1024;
    }

    function formatContributionTotalSize(files) {
      const bytes = (files || []).reduce((sum, file) => sum + parseFileSizeBytes(file.size), 0);
      if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
      }
      if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
      return files?.length ? "-" : "0 kB";
    }

    function contributionFileKind(type) {
      if (/pdf/i.test(type)) return "pdf";
      if (/png|jpe?g|webp|gif|image/i.test(type)) return "image";
      if (/word|doc/i.test(type)) return "doc";
      return "file";
    }

    function contributionFileKindLabel(type) {
      const kind = contributionFileKind(type);
      if (kind === "pdf") return "PDF";
      if (kind === "image") return "IMG";
      if (kind === "doc") return "DOC";
      return "FILE";
    }

    function isContributionExpanded(submissionId) {
      return Boolean(demoState.expandedContributions?.[submissionId]);
    }

    function isContributionFilesExpanded(submissionId) {
      const key = `${submissionId}:files`;
      if (!demoState.expandedContributions) return false;
      if (!(key in demoState.expandedContributions)) return false;
      return Boolean(demoState.expandedContributions[key]);
    }

    function renderPhaseContributions(submissions, patient, { compact = false } = {}) {
      if (!submissions?.length) return "";

      const stats = getContributionBundleStats(submissions);
      const submissionWord = stats.submissionCount === 1 ? "vložení" : stats.submissionCount < 5 ? "vložení" : "vložení";
      const fileWord = stats.fileCount === 1 ? "soubor" : stats.fileCount < 5 ? "soubory" : "souborů";
      const bundleIds = submissions.map((item) => item.id).join(",");

      return `
        <div class="phase-evidence-box${compact ? " phase-evidence-box--compact" : ""}">
          <div class="phase-evidence-summary">
            <div class="phase-evidence-summary-main">
              ${renderMonoIcon("documents", "mono-icon phase-evidence-summary-icon")}
              <span>${stats.submissionCount} ${submissionWord} · ${stats.fileCount} ${fileWord} · ${stats.totalSize}</span>
            </div>
            <button
              type="button"
              class="phase-evidence-download-all"
              data-contrib-download-bundle="${escapeHtml(bundleIds)}"
            >
              ${renderMonoIcon("download", "mono-icon phase-evidence-download-icon")}
              Stáhnout vše
            </button>
          </div>

          <div class="phase-contributions">
            ${submissions.map((submission) => {
              const files = submission.files || [];
              const expanded = isContributionExpanded(submission.id);
              const filesExpanded = expanded && (files.length <= 1 || isContributionFilesExpanded(submission.id));
              const showFiles = expanded && (files.length <= 1 || filesExpanded);
              const fileWordRow = files.length === 1 ? "soubor" : files.length < 5 ? "soubory" : "souborů";
              const totalSize = formatContributionTotalSize(files);

              return `
                <article class="phase-contribution${expanded ? " is-open" : ""}${submission.docRole === "outbound_message" ? " phase-contribution--outbound" : ""}">
                  <div class="phase-contribution-row">
                    <button
                      type="button"
                      class="phase-contribution-expand"
                      data-contrib-toggle="${escapeHtml(submission.id)}"
                      aria-expanded="${expanded ? "true" : "false"}"
                      aria-label="${expanded ? "Sbalit vložení" : "Rozbalit vložení"}"
                    >
                      <span class="phase-contribution-chevron${expanded ? " is-open" : ""}" aria-hidden="true"></span>
                    </button>
                    <button
                      type="button"
                      class="phase-contribution-summary-hit"
                      data-contrib-toggle="${escapeHtml(submission.id)}"
                      aria-expanded="${expanded ? "true" : "false"}"
                    >
                      ${renderAuthorAvatar(submission)}
                      <span class="phase-contribution-summary-text">
                        <strong>${escapeHtml(submission.author || "Tým centra")}</strong>
                        <time>${escapeHtml(formatContributionTimestamp(submission.createdAt))}</time>
                      </span>
                    </button>
                    ${renderSubmissionVisibilityIcon(submission.docRole)}
                    ${files.length ? `
                      <button
                        type="button"
                        class="med-icon-btn phase-contribution-download"
                        data-contrib-download-all="${escapeHtml(submission.id)}"
                        title="Stáhnout vložení"
                        aria-label="Stáhnout vložení"
                      >${renderMonoIcon("download", "mono-icon med-action-icon")}</button>
                    ` : ""}
                  </div>

                  <div class="phase-contribution-body${expanded ? "" : " is-collapsed"}">
                    ${submission.note ? `<p class="phase-contribution-note">${escapeHtml(submission.note)}</p>` : ""}
                    ${files.length ? `
                      ${files.length > 1 ? `
                        <button
                          type="button"
                          class="phase-contribution-files-toggle"
                          data-contrib-files-toggle="${escapeHtml(submission.id)}"
                          aria-expanded="${filesExpanded ? "true" : "false"}"
                        >
                          <span class="phase-contribution-chevron phase-contribution-chevron--small${filesExpanded ? " is-open" : ""}" aria-hidden="true"></span>
                          ${files.length} ${fileWordRow} · ${totalSize}
                        </button>
                      ` : ""}
                      <div class="phase-contribution-files${showFiles ? "" : " is-collapsed"}">
                        ${files.map((file) => `
                          <button
                            type="button"
                            class="phase-file-chip"
                            data-doc-download="${escapeHtml(file.id || file.name)}"
                            title="Stáhnout soubor"
                          >
                            <span class="phase-file-chip-icon phase-file-chip-icon--${contributionFileKind(file.type)}">${contributionFileKindLabel(file.type)}</span>
                            <span class="phase-file-chip-name">${escapeHtml(file.name)}</span>
                            <span class="phase-file-chip-size">${escapeHtml(file.size || "")}</span>
                          </button>
                        `).join("")}
                      </div>
                    ` : ""}
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    function renderHistoryAttachments(attachments, patient = null) {
      if (!attachments?.length) return "";

      return `
        <div class="history-attachments">
          ${attachments.map((file) => {
            const examTitle = patient && file.examId ? findExamTitleForDocument(patient, file) : null;
            const tip = examTitle
              ? `Stáhnout výstup vyšetření: ${examTitle}`
              : (file.examId ? "Stáhnout výstup dokončeného vyšetření" : "Stáhnout soubor");
            const isOutbound = getDocumentRole(file) === "outbound_message";
            return `
            <div class="history-attachment-row${isOutbound ? " is-shared-outbound" : ""}">
              <button type="button" class="history-attachment${file.examId ? " is-exam-output" : ""}" data-doc-download="${file.id || file.name}" title="${escapeHtml(tip)}">
                ${file.name}${file.size ? ` · ${file.size}` : ""}
              </button>
              ${renderFlowDocumentSharingIcon(file)}
            </div>
          `;
          }).join("")}
        </div>
      `;
    }


    function renderStaffPatientDetailPage(patient, options = {}) {
      return `
        <div class="patient-detail-page">
          <div class="patient-detail-toolbar">
            <button type="button" class="btn ghost btn-compact patient-detail-back" data-patient-detail-back>
              ← Zpět na seznam
            </button>
          </div>
          ${renderPathwayPatientPanel(patient, options)}
        </div>
      `;
    }

    function renderAmbulatoryPatientPanel(patient) {
      return renderStaffPatientDetailPage(patient, {
        showReferralEdit: true
      });
    }

    function renderAmbulatoryDashboard(patient) {
      const ownPatients = patientsForAmbulatory();
      const listPatients = preparePatientList(ownPatients);
      const unreadReferralCount = ownPatients.filter((item) => needsReferralChatReply(item)).length;

      if (demoState.patientDetailOpen) {
        return renderAmbulatoryPatientPanel(patient);
      }

      return `
        <div class="card patient-list-page">
          <div class="card-header">
            <div>
              <h3>Moji pacienti</h3>
              ${unreadReferralCount ? `<p class="referral-list-hint">${unreadReferralCount === 1 ? "1 nová zpráva v chatu k žádosti" : `${unreadReferralCount} nové zprávy v chatu k žádosti`}</p>` : ""}
            </div>
            <button class="btn" type="button" data-amb-new-referral>Nové odeslání</button>
          </div>
          ${renderPatientListToolbar()}
          <table class="summary-table patient-list-table">
            <thead>
              <tr>
                <th>Pacient</th>
                <th>Diagnóza</th>
                <th>Stav</th>
                <th>${renderPatientListSortHeader("Aktualizace", "updatedAt")}</th>
                <th class="patient-comm-col">Komunikace</th>
              </tr>
            </thead>
            <tbody>
              ${listPatients.map((item) => renderPatientOverviewRow(item, patient)).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const LTX_DIAGNOSIS_OPTIONS = [
      { code: "J84.1", label: "Idiopatická plicní fibroza (IPF)", short: "IPF" },
      { code: "J44.9", label: "CHOPN s emfyzemem", short: "CHOPN" },
      { code: "E84", label: "Cystická fibroza (CF)", short: "CF" },
      { code: "I27.0", label: "Plicní arteriální hypertenze (PAH)", short: "PAH" },
      { code: "J84.9", label: "Intersticiální plicní onemocnění", short: "ILD" },
      { code: "other", label: "Jiná diagnóza", short: "-" }
    ];

    const INSURANCE_OPTIONS = [
      { code: "111", label: "VZP (111)" },
      { code: "201", label: "VoZP (201)" },
      { code: "211", label: "ZP MV ČR (211)" },
      { code: "205", label: "ČPZP (205)" },
      { code: "207", label: "OZP (207)" }
    ];

    function splitPatientName(fullName) {
      const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return { firstName: "", lastName: "" };
      if (parts.length === 1) return { firstName: parts[0], lastName: "" };
      return { lastName: parts[parts.length - 1], firstName: parts.slice(0, -1).join(" ") };
    }

    function parseBloodGroup(bloodGroup) {
      const match = (bloodGroup || "").match(/^([AB0]+)([+-])?$/i);
      return {
        bloodType: match?.[1]?.toUpperCase() || "",
        rh: match?.[2] || "+"
      };
    }

    function mergeBloodGroup(bloodType, rh) {
      if (!bloodType) return "-";
      return `${bloodType}${rh === "-" ? "-" : "+"}`;
    }

    function guessDiagnosisCode(patient) {
      const short = patient.diagnosisShort || "";
      const text = patient.diagnosis || "";
      const found = LTX_DIAGNOSIS_OPTIONS.find((item) => item.short === short);
      if (found) return found.code;
      if (/fibroza|IPF/i.test(text)) return "J84.1";
      if (/CHOPN|emfyzem/i.test(text)) return "J44.9";
      if (/cystická|CF/i.test(text)) return "E84";
      if (/arteriální hypertenze|PAH/i.test(text)) return "I27.0";
      return "J84.1";
    }

    function diagnosisFromCode(code) {
      const item = LTX_DIAGNOSIS_OPTIONS.find((entry) => entry.code === code);
      if (!item) return { diagnosis: code || "-", diagnosisShort: "-" };
      if (item.code === "other") return { diagnosis: "Jiná diagnóza", diagnosisShort: "-" };
      return { diagnosis: item.label.replace(/\s*\([^)]*\)\s*$/, "").trim(), diagnosisShort: item.short };
    }

    function computeBmi(heightCm, weightKg) {
      const h = Number(heightCm);
      const w = Number(weightKg);
      if (!h || !w) return "";
      return (w / ((h / 100) ** 2)).toFixed(1);
    }

    function ageFromBirthDate(birthDate) {
      const match = (birthDate || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (!match) return 0;
      const born = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      const now = new Date();
      let age = now.getFullYear() - born.getFullYear();
      const monthDiff = now.getMonth() - born.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
      return age > 0 ? age : 0;
    }

    function getPatientDemographics(patient) {
      if (patient.demographics) {
        return { ...patient.demographics };
      }
      const { firstName, lastName } = splitPatientName(patient.name);
      const { bloodType, rh } = parseBloodGroup(patient.bloodGroup);
      return {
        firstName,
        lastName,
        birthNumber: "",
        birthDate: "",
        gender: "",
        insurance: "111",
        phone: "",
        email: "",
        address: patient.city && patient.city !== "-" ? patient.city : "",
        bloodType,
        rh,
        heightCm: "",
        weightKg: "",
        frailtyScore: "",
        diagnosisCode: guessDiagnosisCode(patient),
        diagnosisDate: "",
        currentTreatment: patient.referral?.currentTreatment || ""
      };
    }

    function formatDemographicsSummary(patient) {
      const d = patient.demographics || getPatientDemographics(patient);
      const bmi = computeBmi(d.heightCm, d.weightKg);
      return [
        d.diagnosisCode,
        d.birthNumber ? `RC ${d.birthNumber}` : null,
        bmi ? `BMI ${bmi}` : null
      ].filter(Boolean).join(" · ");
    }

    function getPatientPortalEmail(patient) {
      if (!patient) return "";
      const demographics = patient.demographics || getPatientDemographics(patient);
      return String(demographics.email || patient.portalEmail || "").trim();
    }

    function isValidPatientEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
    }

    function isWaitlistPortalActivationTransition(patient, targetState) {
      return Boolean(patient && patient.state === "POSUZOVANI" && targetState === "WL");
    }

    function patientPortalUserIsInactive(patient) {
      const user = window.LtxAdmin?.getPatientPortalUser?.(patient);
      return Boolean(user && user.active === false);
    }

    function renderPortalActivationBanner(patient) {
      const email = getPatientPortalEmail(patient);
      if (!email || !isValidPatientEmail(email)) {
        return `
          <div class="flow-portal-activation flow-portal-activation--warn">
            <p class="flow-portal-activation-title">Aktivace účtu pacienta</p>
            <p class="flow-portal-activation-text">
              Při přechodu na čekací listinu se pacientovi aktivuje účet v pacientském portálu a odešle se e-mail s přístupem.
              U tohoto pacienta chybí platný e-mail - nejdříve ho doplňte v odeslání nebo v údajích pacienta.
            </p>
          </div>
        `;
      }

      const inactiveAccount = patientPortalUserIsInactive(patient) || patient.portalPending === true;
      const activationNote = inactiveAccount
        ? "Účet pacienta je zatím <strong>neaktivní</strong> (vznikl při odeslání). Po potvrzení přechodu na čekací listinu bude <strong>aktivován</strong>, i když byl dříve deaktivován."
        : "Po potvrzení se pacientovi <strong>aktivuje účet</strong> v pacientském portálu.";

      return `
        <div class="flow-portal-activation">
          <p class="flow-portal-activation-title">Aktivace účtu pacienta</p>
          <p class="flow-portal-activation-text">
            ${activationNote}
            Na e-mail <span class="flow-portal-activation-email">${escapeHtml(email)}</span>
            odejde zpráva s přístupovými údaji. Pacient se pak přihlašuje tímto e-mailem.
          </p>
        </div>
      `;
    }

    function referralAttachmentsToPickerItems(attachments = []) {
      return attachments.map((file, index) => ({
        id: file.id || `amb-ref-${index}-${Date.now()}`,
        name: file.name,
        type: file.type || "PDF",
        size: file.size || "-",
        description: file.description || file.name,
        date: file.date
      }));
    }

    function buildReferralAttachmentsFromItems(attachItems, patientId, date, addedBy) {
      const stamp = Date.now();
      return attachItems.map((file, index) => ({
        id: (file.id && !file.id.startsWith("upload-")) ? file.id : `${patientId}-ref-${stamp}-${index}`,
        name: file.name,
        type: file.type || "PDF",
        size: file.size === "-" ? "120 kB" : file.size,
        date: file.date || date,
        description: file.description || file.name,
        addedBy: addedBy || "",
        addedAt: date
      }));
    }

    function renderSelectOptions(options, selected) {
      return options.map((option) => `
        <option value="${escapeHtml(option.code)}" ${option.code === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>
      `).join("");
    }

    function collectAmbPatientDemographics() {
      return {
        firstName: document.getElementById("ambFirstName")?.value.trim() || "",
        lastName: document.getElementById("ambLastName")?.value.trim() || "",
        birthNumber: document.getElementById("ambBirthNumber")?.value.trim() || "",
        birthDate: document.getElementById("ambBirthDate")?.value.trim() || "",
        gender: document.getElementById("ambGender")?.value || "",
        insurance: document.getElementById("ambInsurance")?.value || "",
        phone: document.getElementById("ambPhone")?.value.trim() || "",
        email: document.getElementById("ambEmail")?.value.trim() || "",
        address: document.getElementById("ambAddress")?.value.trim() || "",
        bloodType: document.getElementById("ambBloodType")?.value || "",
        rh: document.getElementById("ambRh")?.value || "+",
        heightCm: document.getElementById("ambHeightCm")?.value.trim() || "",
        weightKg: document.getElementById("ambWeightKg")?.value.trim() || "",
        diagnosisCode: document.getElementById("ambDiagnosisCode")?.value || "",
        diagnosisDate: document.getElementById("ambDiagnosisDate")?.value.trim() || "",
        currentTreatment: document.getElementById("ambCurrentTreatment")?.value.trim() || ""
      };
    }

    function applyDemographicsToPatient(patient, demographics) {
      patient.demographics = { ...demographics };
      patient.name = `${demographics.firstName} ${demographics.lastName}`.trim();
      patient.bloodGroup = mergeBloodGroup(demographics.bloodType, demographics.rh);
      patient.age = ageFromBirthDate(demographics.birthDate) || patient.age || 0;
      if (demographics.address) {
        const cityPart = demographics.address.split(",").map((part) => part.trim()).pop();
        if (cityPart) patient.city = cityPart;
      }
      const diag = diagnosisFromCode(demographics.diagnosisCode);
      patient.diagnosis = diag.diagnosis;
      patient.diagnosisShort = diag.diagnosisShort;
      if (!patient.referral) patient.referral = {};
      patient.referral.currentTreatment = demographics.currentTreatment;
    }

    function canEditPatientDemographics(patient) {
      if (!patient?.id) return false;
      const user = activeUser();
      if (user.roleId === "coordinator") return true;
      if (user.roleId === "ambulatory") return patient.referrerId === user.id;
      if (isClinicalTeamViewer()) return true;
      return false;
    }

    function patientEditTarget() {
      const patientId = demoState.patientEditId;
      return patientId ? patients.find((item) => item.id === patientId) : null;
    }

    function renderPatientEditForm(patient) {
      const d = getPatientDemographics(patient);
      const user = activeUser();
      const isInternal = user.roleId === "coordinator" || isClinicalTeamViewer();

      return `
        <div class="patient-edit-header">
          <h3 id="patientEditModalTitle">Údaje pacienta</h3>
          <button type="button" class="patient-edit-close" data-close-patient-edit aria-label="Zavřít">×</button>
        </div>
        <div class="patient-edit-body">
          <p class="patient-edit-modal-sub">
            Identifikace a kontakt pro <strong>${escapeHtml(patient.name)}</strong>.
            E-mail slouží k přihlášení do portálu po zařazení na čekací listinu.
          </p>
          <div class="field-grid">
            <div class="field">
              <label for="peLastName">Příjmení</label>
              <input id="peLastName" value="${escapeHtml(d.lastName)}">
            </div>
            <div class="field">
              <label for="peFirstName">Jméno</label>
              <input id="peFirstName" value="${escapeHtml(d.firstName)}">
            </div>
            <div class="field">
              <label for="peBirthNumber">Rodné číslo</label>
              <input id="peBirthNumber" placeholder="630101/1234" value="${escapeHtml(d.birthNumber)}">
            </div>
            <div class="field">
              <label for="peBirthDate">Datum narození</label>
              <input id="peBirthDate" placeholder="dd.mm.rrrr" value="${escapeHtml(d.birthDate)}">
            </div>
            <div class="field">
              <label for="peGender">Pohlaví</label>
              <select id="peGender">
                <option value="">-</option>
                <option value="žena" ${d.gender === "žena" ? "selected" : ""}>žena</option>
                <option value="muž" ${d.gender === "muž" ? "selected" : ""}>muž</option>
              </select>
            </div>
            <div class="field">
              <label for="peInsurance">Pojišťovna</label>
              <select id="peInsurance">${renderSelectOptions(INSURANCE_OPTIONS, d.insurance || "111")}</select>
            </div>
            <div class="field">
              <label for="pePhone">Telefon</label>
              <input id="pePhone" value="${escapeHtml(d.phone)}">
            </div>
            <div class="field">
              <label for="peEmail">E-mail</label>
              <input id="peEmail" type="email" autocomplete="email" placeholder="jan.novak@email.cz" value="${escapeHtml(d.email || "")}">
            </div>
            <div class="field">
              <label for="peAddress">Adresa</label>
              <input id="peAddress" value="${escapeHtml(d.address)}">
            </div>
          </div>
        </div>
        <div class="patient-edit-footer">
          <button type="button" class="btn secondary" data-close-patient-edit>Zrušit</button>
          <button type="button" class="btn" data-save-patient-edit>Uložit</button>
        </div>
      `;
    }

    function collectPatientEditDemographics() {
      const existing = getPatientDemographics(patientEditTarget() || {});

      return {
        ...existing,
        firstName: document.getElementById("peFirstName")?.value.trim() || "",
        lastName: document.getElementById("peLastName")?.value.trim() || "",
        birthNumber: document.getElementById("peBirthNumber")?.value.trim() || "",
        birthDate: document.getElementById("peBirthDate")?.value.trim() || "",
        gender: document.getElementById("peGender")?.value || "",
        insurance: document.getElementById("peInsurance")?.value || "",
        phone: document.getElementById("pePhone")?.value.trim() || "",
        email: document.getElementById("peEmail")?.value.trim() || "",
        address: document.getElementById("peAddress")?.value.trim() || ""
      };
    }

    function openPatientEditModal(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient || !canEditPatientDemographics(patient)) return;

      const modal = document.getElementById("patientEditModal");
      const body = document.getElementById("patientEditModalBody");
      if (!modal || !body) return;

      demoState.patientEditId = patientId;
      body.innerHTML = renderPatientEditForm(patient);
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      syncPageScrollLock();
      body.querySelector("#peLastName")?.focus();
    }

    function closePatientEditModal() {
      const modal = document.getElementById("patientEditModal");
      if (!modal) return;

      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      demoState.patientEditId = null;
      syncPageScrollLock();
    }

    function savePatientEditDemographics() {
      const patient = patientEditTarget();
      if (!patient || !canEditPatientDemographics(patient)) return;

      const demographics = collectPatientEditDemographics();
      if (!demographics.lastName && !demographics.firstName) {
        showToast("Vyplňte jméno a příjmení.");
        return;
      }

      if (demographics.email && !isValidPatientEmail(demographics.email)) {
        showToast("Zadejte platný e-mail pacienta.");
        return;
      }

      applyDemographicsToPatient(patient, demographics);
      const now = formatDemoTimestamp();
      touchPatientUpdated(patient, now);

      const portalUser = window.LtxAdmin?.getPatientPortalUser?.(patient);
      if (portalUser || patient.portalPending || demographics.email) {
        if (!patient.portalActivated && demographics.email && isValidPatientEmail(demographics.email)) {
          window.LtxAdmin?.ensureInactivePatientPortalUser?.(patient, { createdAt: now });
        } else {
          window.LtxAdmin?.syncPatientPortalUserProfile?.(patient);
        }
        demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      }

      const user = activeUser();
      demoState.audit.unshift(`${now} - ${user.name} upravil identifikační údaje pacienta ${patient.name}.`);
      closePatientEditModal();
      render();
      showToast("Údaje pacienta byly uloženy.");
    }

    function wirePatientEditModalOnce() {
      if (wirePatientEditModalOnce.done) return;
      wirePatientEditModalOnce.done = true;

      const modal = document.getElementById("patientEditModal");
      modal?.addEventListener("click", (event) => {
        if (event.target.id === "patientEditModal") {
          closePatientEditModal();
          return;
        }

        const closeBtn = event.target.closest("[data-close-patient-edit]");
        if (closeBtn) {
          event.preventDefault();
          closePatientEditModal();
          return;
        }

        const saveBtn = event.target.closest("[data-save-patient-edit]");
        if (saveBtn) {
          event.preventDefault();
          savePatientEditDemographics();
        }
      });
    }

    function wireAmbPatientForm() {
      const heightEl = document.getElementById("ambHeightCm");
      const weightEl = document.getElementById("ambWeightKg");
      const bmiEl = document.getElementById("ambBmiDisplay");
      const updateBmi = () => {
        if (!bmiEl) return;
        const bmi = computeBmi(heightEl?.value, weightEl?.value);
        bmiEl.textContent = bmi || "-";
      };
      heightEl?.addEventListener("input", updateBmi);
      weightEl?.addEventListener("input", updateBmi);
    }

    function renderAmbulatoryReferralTab(patient) {
      const referral = patient.referral || {};
      const isNew = demoState.ambNewReferral;
      const isEdit = demoState.ambEditReferral;
      
      // Pokud jde o nové odeslání, nebudeme předvyplňovat data z vybraného pacienta
      const d = isNew ? {} : getPatientDemographics(patient);
      const bmi = isNew ? "" : computeBmi(d.heightCm, d.weightKg);
      const attachmentItems = isNew
        ? []
        : referralAttachmentsToPickerItems(referral.attachments || []);

      return `
        <div class="amb-referral-layout">
          <div class="card amb-patient-form-card">
            <div class="card-header">
              <div>
                <h3>${isNew ? "Nové odeslání pacienta" : "Doplnit žádost"}</h3>
                <p class="amb-referral-sub">FN Motol · identifikace, diagnóza, přílohy s popisem a průvodní dopis</p>
              </div>
            </div>

            <div class="amb-form-grid">
              <section class="amb-form-panel">
                <h4 class="form-section-title">Identifikace pacienta</h4>
                <div class="field-grid">
                  <div class="field">
                    <label for="ambLastName">Příjmení</label>
                    <input id="ambLastName" value="${escapeHtml(d.lastName || "")}">
                  </div>
                  <div class="field">
                    <label for="ambFirstName">Jméno</label>
                    <input id="ambFirstName" value="${escapeHtml(d.firstName || "")}">
                  </div>
                  <div class="field">
                    <label for="ambBirthNumber">Rodné číslo</label>
                    <input id="ambBirthNumber" placeholder="630101/1234" value="${escapeHtml(d.birthNumber || "")}">
                  </div>
                  <div class="field">
                    <label for="ambBirthDate">Datum narození</label>
                    <input id="ambBirthDate" placeholder="dd.mm.rrrr" value="${escapeHtml(d.birthDate || "")}">
                  </div>
                  <div class="field">
                    <label for="ambPhone">Telefon</label>
                    <input id="ambPhone" value="${escapeHtml(d.phone || "")}">
                  </div>
                  <div class="field">
                    <label for="ambEmail" class="field-label-required">E-mail pacienta</label>
                    <input id="ambEmail" type="email" autocomplete="email" placeholder="jan.novak@email.cz" value="${escapeHtml(d.email || "")}" ${isNew ? "required" : ""}>
                  </div>
                  <div class="field">
                    <label for="ambGender">Pohlaví</label>
                    <select id="ambGender">
                      <option value="">-</option>
                      <option value="žena" ${d.gender === "žena" ? "selected" : ""}>žena</option>
                      <option value="muž" ${d.gender === "muž" ? "selected" : ""}>muž</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="ambInsurance">Pojišťovna</label>
                    <select id="ambInsurance">${renderSelectOptions(INSURANCE_OPTIONS, d.insurance || "111")}</select>
                  </div>
                  <div class="field field-span-all">
                    <label for="ambAddress">Adresa trvalého bydliště</label>
                    <input id="ambAddress" value="${escapeHtml(d.address || "")}">
                  </div>
                </div>
                
                <div class="amb-anthro-section">
                  <h5 class="amb-anthro-title">Antropometrie a krevní skupina</h5>
                  <div class="amb-anthro-grid">
                    <div class="field">
                      <label for="ambBloodType">Krevní skupina</label>
                      <select id="ambBloodType">
                        <option value="">-</option>
                        <option value="A" ${d.bloodType === "A" ? "selected" : ""}>A</option>
                        <option value="B" ${d.bloodType === "B" ? "selected" : ""}>B</option>
                        <option value="0" ${d.bloodType === "0" ? "selected" : ""}>0</option>
                        <option value="AB" ${d.bloodType === "AB" ? "selected" : ""}>AB</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="ambRh">Rh faktor</label>
                      <select id="ambRh">
                        <option value="+" ${d.rh === "+" ? "selected" : ""}>pozitivní (+)</option>
                        <option value="-" ${d.rh === "-" ? "selected" : ""}>negativní (−)</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="ambHeightCm">Výška (cm)</label>
                      <input id="ambHeightCm" type="number" min="0" step="1" value="${escapeHtml(d.heightCm || "")}">
                    </div>
                    <div class="field">
                      <label for="ambWeightKg">Hmotnost (kg)</label>
                      <input id="ambWeightKg" type="number" min="0" step="0.1" value="${escapeHtml(d.weightKg || "")}">
                    </div>
                    <div class="field amb-bmi-field">
                      <label>Vypočtené BMI</label>
                      <div class="bmi-display-box">
                        <span class="bmi-value" id="ambBmiDisplay">${escapeHtml(bmi || "-")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="amb-form-panel">
                <h4 class="form-section-title">Diagnóza a dosavadní léčba</h4>
                <div class="field-grid">
                  <div class="field">
                    <label for="ambDiagnosisCode">Základní diagnóza (MKN-10)</label>
                    <select id="ambDiagnosisCode">${renderSelectOptions(LTX_DIAGNOSIS_OPTIONS, d.diagnosisCode || "J84.1")}</select>
                  </div>
                  <div class="field">
                    <label for="ambDiagnosisDate">Datum stanovení diagnózy</label>
                    <input id="ambDiagnosisDate" placeholder="dd.mm.rrrr" value="${escapeHtml(d.diagnosisDate || "")}">
                  </div>
                </div>
                <div class="field amb-treatment-field">
                  <label for="ambCurrentTreatment">Dosavadní léčba</label>
                  <textarea id="ambCurrentTreatment" rows="5">${escapeHtml(d.currentTreatment || "")}</textarea>
                </div>
              </section>

              <section class="amb-form-panel amb-form-panel-wide">
                <h4 class="form-section-title">Odeslání do centra</h4>
                <div class="amb-send-grid">
                  <div class="field">
                    <label>Přílohy</label>
                    ${renderFileUpload({
                      listId: "ambReferralAttachList",
                      inputId: "ambReferralFileInput",
                      pickBtnId: "ambReferralPickFiles",
                      items: attachmentItems,
                      hint: "U každé přílohy uveďte popis",
                      withDescription: true
                    })}
                  </div>
                  <div class="field">
                    <label for="ambCoverLetter">Průvodní dopis</label>
                    <textarea id="ambCoverLetter" class="amb-cover-letter">${isNew ? "Vážení kolegové,\n\nzasílám pacienta k posouzení indikace transplantace plic...\n\nMUDr. Pavel Urban" : escapeHtml(referral.coverLetter || "")}</textarea>
                  </div>
                </div>
              </section>
            </div>

            <div class="amb-referral-footer">
              <button class="btn secondary" type="button" data-amb-cancel-referral-form>Zrušit</button>
              <button class="btn" type="button" data-demo-action="referral-save">${isNew ? "Vytvořit odeslání" : "Uložit změny"}</button>
            </div>
          </div>
        </div>
      `;
    }

    function renderAmbulatoryMessagesTab() {
      const ownPatients = patientsForAmbulatory();

      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Průběh všech pacientů</h3>
            </div>
          </div>
          <div class="list">
            ${ownPatients.map((item) => `
              <div class="item">
                <div>
                  <h4>${item.name}</h4>
                  <p>${item.diagnosisShort} · <span class="pill ${statePillClass(item.state)}">${phaseLabel(item.state)}</span></p>
                  ${renderAmbulatoryFlow(item, true)}
                </div>
                <button class="btn ghost" type="button" data-select-patient="${item.id}" data-amb-go-overview>Detail</button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function renderAmbulatoryWorkspace(patient) {
      if (demoState.ambNewReferral || demoState.ambEditReferral) {
        return renderAmbulatoryReferralTab(patient);
      }
      return renderAmbulatoryDashboard(patient);
    }

    function saveAmbulatoryReferral() {
      const user = activeUser();
      if (user.roleId !== "ambulatory") return;

      const isNew = demoState.ambNewReferral;
      const demographics = collectAmbPatientDemographics();
      const coverLetter = document.getElementById("ambCoverLetter")?.value.trim();
      const attachItems = collectAttachListItems("ambReferralAttachList", { withDescription: true });

      if (!demographics.lastName && !demographics.firstName) {
        showToast("Vyplňte jméno a příjmení pacienta.");
        return;
      }

      if (!demographics.email) {
        showToast("Vyplňte e-mail pacienta. Slouží k přihlášení do portálu po schválení.");
        return;
      }

      if (!isValidPatientEmail(demographics.email)) {
        showToast("Zadejte platný e-mail pacienta.");
        return;
      }

      if (!attachItems.length) {
        showToast("Přiložte alespoň jednu přílohu.");
        return;
      }

      if (attachItems.some((file) => !file.description)) {
        showToast("Vyplňte popis u všech příloh.");
        return;
      }

      const now = formatDemoTimestamp();
      const dateShort = now.split(/\s+/).slice(0, 2).join(" ");
      const displayName = `${demographics.firstName} ${demographics.lastName}`.trim();
      const summaryText = demographics.currentTreatment
        ? demographics.currentTreatment.split("\n")[0].slice(0, 120)
        : "Odeslání k posouzení transplantace plic.";

      if (isNew) {
        const newId = `p-new-${Date.now()}`;
        const attachments = buildReferralAttachmentsFromItems(attachItems, newId, dateShort, user.name);
        const diag = diagnosisFromCode(demographics.diagnosisCode);

        const newPatient = {
          id: newId,
          name: displayName,
          age: ageFromBirthDate(demographics.birthDate),
          city: demographics.address ? demographics.address.split(",").pop()?.trim() || "-" : "-",
          country: "CZ",
          diagnosis: diag.diagnosis,
          diagnosisShort: diag.diagnosisShort,
          bloodGroup: mergeBloodGroup(demographics.bloodType, demographics.rh),
          demographics: { ...demographics },
          summary: summaryText,
          state: "POSUZOVANI",
          referrerId: user.id,
          referrer: `${user.name}, ${user.workplace}`,
          referral: {
            sentDate: dateShort,
            status: "Odesláno do centra",
            coverLetter,
            currentTreatment: demographics.currentTreatment,
            attachments,
            updatedAt: now,
            thread: []
          },
          flowEvidence: { rozhodnutí: [], ukonceno: [] },
          teamDecision: null,
          carePlan: null,
          exams: [],
          measurements: [],
          educationProgress: 0,
          medicationAdherence: 0,
          medications: [],
          updatedAt: now
        };

        patients.push(newPatient);
        demoState.patientId = newId;
        const portalSetup = window.LtxAdmin?.ensureInactivePatientPortalUser?.(newPatient, { createdAt: now });
        if (portalSetup?.ok) {
          demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
          demoState.audit.unshift(
            `${now} - Systém vytvořil neaktivní účet pacientského portálu pro ${displayName} (${portalSetup.email}).`
          );
        }
        demoState.audit.unshift(`${now} - ${user.name} odeslal nového pacienta ${displayName} do centra.`);
        demoState.ambNewReferral = false;
        demoState.ambEditReferral = false;
        demoState.mainTab = "overview";
        render();
        openAmbReferralSentModal(displayName);
        return;
      }

      const patient = selectedPatient();
      if (!patient || patient.referrerId !== user.id) return;

      applyDemographicsToPatient(patient, demographics);
      if (!patient.referral) patient.referral = {};

      const attachments = buildReferralAttachmentsFromItems(attachItems, patient.id, dateShort, user.name);
      patient.referral.coverLetter = coverLetter;
      patient.referral.currentTreatment = demographics.currentTreatment;
      patient.referral.attachments = attachments;
      patient.summary = summaryText;
      touchPatientUpdated(patient, now);

      if (patient.state === "POSUZOVANI") {
        const portalSetup = window.LtxAdmin?.ensureInactivePatientPortalUser?.(patient, { createdAt: now });
        if (portalSetup?.ok) demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      }

      demoState.audit.unshift(`${now} - ${user.name} upravil žádost pacienta ${patient.name}.`);
      showToast("Žádost byla uložena.");

      demoState.ambNewReferral = false;
      demoState.ambEditReferral = false;
      demoState.mainTab = "overview";
      render();
    }

    function renderCoordinatorPatientPanel(patient) {
      return renderStaffPatientDetailPage(patient, {
        showReferrer: true,
        showCoordinatorFlowTools: true,
        hideSummaryCard: true
      });
    }

    function renderClinicalPatientsDashboard(patient, options = {}) {
      const { canEditState = false } = options;
      const listPatients = preparePatientList(patients);

      if (demoState.patientDetailOpen) {
        return renderStaffPatientDetailPage(patient, {
          showReferrer: true,
          hideSummaryCard: true,
          showCoordinatorFlowTools: canEditState
        });
      }

      return `
        <div class="card patient-list-page">
          <div class="card-header">
            <div>
              <h3>Všichni pacienti</h3>
            </div>
          </div>
          ${renderPatientListToolbar()}
          <table class="summary-table patient-list-table">
            <thead>
              <tr>
                <th>Pacient</th>
                <th>Diagnóza</th>
                <th>Pneumologie</th>
                <th>Stav</th>
                <th>${renderPatientListSortHeader("Aktualizace", "updatedAt")}</th>
                <th class="patient-comm-col">Komunikace</th>
              </tr>
            </thead>
            <tbody>
              ${listPatients.map((item) => renderPatientOverviewRow(item, patient, { showPneumology: true })).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderCoordinatorDashboard(patient) {
      return renderClinicalPatientsDashboard(patient, { canEditState: true });
    }

    function renderWorkspaceNav() {
      const tabs = tabsForRole(activeUser().roleId);
      if (tabs.length <= 1) return "";

      const activeTab = demoState.mainTab || tabs[0].id;
      return `
        <nav class="workspace-tabs" aria-label="Hlavní sekce">
          ${tabs.map((tab) => `
            <button
              type="button"
              class="workspace-tab ${tab.id === activeTab ? "active" : ""}"
              data-main-tab="${tab.id}"
            >${tab.label}</button>
          `).join("")}
        </nav>
      `;
    }

    function checkBloodGroupCompatibility(donorBG, patientBG) {
      if (!donorBG || !patientBG) return false;
      const d = donorBG.replace(/[\s\+]/g, "").toUpperCase();
      const p = patientBG.replace(/[\s\+]/g, "").toUpperCase();
      if (d === "0" || d === "O") return true;
      if (p === "AB") return true;
      return d === p;
    }

    function calculateOrganCompatibility(donor, patient) {
      if (!donor || !patient) return null;
      
      const pBG = patient.bloodGroup || (patient.demographics?.bloodType + patient.demographics?.rh) || "";
      const donorBG = donor.bloodGroup || "";
      const aboCompatible = checkBloodGroupCompatibility(donorBG, pBG);
      
      const donorHeight = parseInt(donor.heightCm) || 0;
      const patientHeight = parseInt(patient.demographics?.heightCm || patient.heightCm) || 0;
      let sizeMatch = "N/A";
      let sizeOk = false;
      if (donorHeight && patientHeight) {
        const ratio = Math.round((donorHeight / patientHeight) * 100);
        sizeMatch = `${ratio} % (výška)`;
        sizeOk = ratio >= 80 && ratio <= 120;
      }
      
      const ageDiff = Math.abs((donor.age || 0) - (patient.age || 0));
      const ageOk = ageDiff <= 35;
      
      const serology = donor.serology || {};
      const warnings = [];
      if (serology.cmv === "pos") warnings.push("Dárce CMV+");
      if (serology.ebv === "pos") warnings.push("Dárce EBV+");

      return {
        abo: { label: `ABO (${donorBG} → ${pBG})`, ok: aboCompatible },
        size: { label: `Velikostní shoda: ${sizeMatch}`, ok: sizeOk },
        age: { label: `Věk dárce (${donor.age} let) vs příjemce (${patient.age} let)`, ok: ageOk },
        warnings: warnings,
        overall: aboCompatible && sizeOk ? "Vhodná shoda - k posouzení týmem" : "Marginální shoda - vyžaduje zvýšenou pozornost"
      };
    }

    function scrollOrganOfferChatToBottom() {
      const feed = document.getElementById("organOfferChatFeedSidebar");
      if (feed) {
        feed.scrollTop = feed.scrollHeight;
      }
    }

    function renderOrganOfferCard(offer) {
      const donor = offer.donor || {};
      const donorSummary = [
        `${donor.age || "?"} let, ${donor.sex || "?"}`,
        `${donor.heightCm || "?"} cm / ${donor.weightKg || "?"} kg`,
        donor.bloodGroup || "?",
        donor.collectionHospital || ""
      ].filter(Boolean).join(" · ");

      return `
        <button
          type="button"
          class="organ-offer-card ${offer.status === "new" ? "organ-offer-card--new" : ""}"
          data-select-organ-offer="${offer.id}"
        >
          <div class="organ-offer-card-main">
            <div class="organ-offer-card-head">
              <strong>${offer.code}</strong>
              <span class="pill ${organOfferStatusClass(offer.status)}">${organOfferStatusLabel(offer.status)}</span>
            </div>
            <p class="organ-offer-card-meta">${donorSummary}</p>
            ${offer.status === "accepted" ? `<p class="organ-offer-card-outcome">Přijato pro: ${offer.handledFor || "-"}</p>` : ""}
            ${offer.status === "rejected" ? `<p class="organ-offer-card-outcome">Odmítnuto: ${offer.rejectReason || "-"}</p>` : ""}
          </div>
          <div class="organ-offer-card-side">
            <div>
              <span class="organ-offer-timer">⏱ Vyprší za ${offer.expiresInMin ?? "?"} min</span>
              <span class="organ-offer-ischemia">Studená ischemie: ${offer.coldIschemiaMin ?? "?"} min</span>
            </div>
          </div>
        </button>
      `;
    }

    function renderOrganOffersList() {
      const activeOffers = organOffers.filter((item) => item.archiveStatus === "active");
      const archivedOffers = organOffers.filter((item) => item.archiveStatus === "archived");

      return `
        <div class="organ-offers-page">
          <header class="organ-offers-header">
            <div style="flex: 1;">
              <h2>Nabídky orgánů</h2>
              <p>Příchozí nabídky od KST / dárcovských center. Akceptace zahájí logistiku a založí plánovaný výkon.</p>
            </div>
            <button class="btn btn-primary" type="button" data-new-organ-offer>
              ${renderMonoIcon("plus", "mono-icon")}
              Nová nabídka
            </button>
          </header>

          <section class="organ-offers-section">
            <h3 class="organ-offers-section-title">
              <span class="organ-offers-section-icon" aria-hidden="true">${renderMonoIcon("organOffers")}</span>
              Aktivní (${activeOffers.length})
            </h3>
            ${activeOffers.length
              ? `<div class="organ-offers-list">${activeOffers.map(renderOrganOfferCard).join("")}</div>`
              : `<p class="organ-offers-empty">Žádné aktivní nabídky.</p>`}
          </section>

          <section class="organ-offers-section">
            <h3 class="organ-offers-section-title">Archiv (${archivedOffers.length})</h3>
            ${archivedOffers.length
              ? `<div class="organ-offers-list">${archivedOffers.map(renderOrganOfferCard).join("")}</div>`
              : `<p class="organ-offers-empty">Zatím žádný archiv.</p>`}
          </section>
        </div>
      `;
    }

    function renderOrganOfferSerologyTag(label, value) {
      const isPositive = String(value).toLowerCase() === "pos";
      return `<span class="organ-serology-tag ${isPositive ? "organ-serology-tag--pos" : ""}">${label}: ${isPositive ? "POZ" : "NEG"}</span>`;
    }

    function getOrganOfferChatParticipants(offer) {
      const staff = getInternalStaffUsers();
      const authors = new Set((offer.thread || []).map((m) => m.authorId));
      const baseIds = ["u-coord", "u-tx"];
      const participantIds = new Set([...baseIds, ...authors]);
      return [...participantIds]
        .map((id) => demoUsers.find((u) => u.id === id))
        .filter(Boolean);
    }

    function renderOrganOfferChatMessage(message) {
      const isOwn = message.authorId === demoState.userId;
      const authorUser = demoUsers.find((item) => item.id === message.authorId);
      const avatarUrl = authorUser ? getUserAvatarUrl(authorUser) : "/static/img/avatars/default.jpg";

      return `
        <article class="internal-chat-message ${isOwn ? "own" : ""}">
          <img class="internal-chat-message-avatar" src="${avatarUrl}" alt="">
          <div class="internal-chat-message-content">
            <div class="internal-chat-message-meta">
              <span class="internal-chat-message-author">${escapeHtml(message.author)}</span>
              <span class="internal-chat-message-role">• ${escapeHtml(getInternalChatAuthorRole(message))}</span>
              <time class="internal-chat-message-time">${escapeHtml(message.createdAt)}</time>
            </div>
            ${message.body ? `
              <div class="internal-chat-message-bubble">
                <p>${renderInternalChatBody(message.body)}</p>
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }

    function renderOrganOfferChatFeedItems(offer) {
      const messages = [...(offer.thread || [])].sort((a, b) => parseDemoDate(a.createdAt) - parseDemoDate(b.createdAt));
      if (!messages.length) return "";

      return messages.map((message) => {
        return renderOrganOfferChatMessage(message);
      }).join("");
    }

    function renderOrganOfferChatBody(offer) {
      const participants = getOrganOfferChatParticipants(offer);
      const participantLabel = participants.length === 1
        ? "1 účastník"
        : `${participants.length} účastníci`;

      return `
        <div class="internal-chat-participants" style="padding: 12px 24px; border-bottom: 1px solid var(--line);">
          <span class="internal-chat-participants-label">
            ${renderMonoIcon("participants", "mono-icon internal-chat-participants-icon")}
            ${participantLabel}
          </span>
          <div class="internal-chat-participant-list">
            ${participants.map((user) => `
              <span class="internal-chat-participant-pill" title="${escapeHtml(user.name)}">
                <img src="${getUserAvatarUrl(user)}" alt="">
                <span>${escapeHtml(user.name)}</span>
                <span class="internal-chat-online-dot" aria-hidden="true"></span>
              </span>
            `).join("")}
          </div>
        </div>
        <div class="internal-chat-feed" id="organOfferChatFeedSidebar" style="padding: 20px 24px;">
          ${(offer.thread || []).length ? renderOrganOfferChatFeedItems(offer) : `
            <p class="referral-chat-empty">Zatím bez zpráv k nabídce.</p>
          `}
        </div>
        <div class="internal-chat-composer" style="padding: 16px 24px; border-top: 1px solid var(--line);">
          <textarea id="organOfferChatInput" rows="3" placeholder="Napište zprávu… použijte @ pro označení kolegy"></textarea>
          <div class="internal-chat-composer-actions">
            <button type="button" class="btn internal-chat-send-btn" data-send-organ-offer-chat="${offer.id}">
              ${renderMonoIcon("send", "mono-icon internal-chat-send-icon")}
              Odeslat
            </button>
          </div>
        </div>
      `;
    }

    function renderOrganOfferChatSidebar() {
      if (!demoState.organOfferChatOpen) return "";
      const offer = selectedOrganOffer();
      if (!offer) return "";

      return `
        <div class="organ-offer-chat-sidebar-overlay" data-toggle-organ-offer-chat></div>
        <div class="organ-offer-chat-sidebar">
          <div class="internal-chat-header" style="border-bottom: 1px solid var(--line);">
            <span class="internal-chat-header-icon" aria-hidden="true">${renderMonoIcon("communication")}</span>
            <div style="flex: 1;">
              <h3>Interní komunikace k nabídce ${offer.code}</h3>
              <p>Sdílení informací a koordinace k dárci.</p>
            </div>
            <button type="button" class="organ-offer-chat-close" data-toggle-organ-offer-chat aria-label="Zavřít">
              ${renderMonoIcon("close", "mono-icon")}
            </button>
          </div>
          <div class="organ-offer-chat-sidebar-body">
            ${renderOrganOfferChatBody(offer)}
          </div>
        </div>
      `;
    }

    function sendOrganOfferChatMessage(offerId) {
      const offer = organOffers.find((o) => o.id === offerId);
      if (!offer) return;

      const user = activeUser();
      const message = document.getElementById("organOfferChatInput")?.value.trim();
      if (!message) {
        showToast("Napište zprávu.");
        return;
      }

      const now = formatDemoTimestamp();
      if (!offer.thread) offer.thread = [];

      offer.thread.push({
        id: `msg-${Date.now()}`,
        authorId: user.id,
        author: user.name,
        authorRole: user.roleId,
        body: message,
        createdAt: now
      });

      demoState.audit.unshift(`${now} - ${user.name} poslal zprávu k nabídce ${offer.code}.`);
      render();
      showToast("Zpráva byla odeslána.");
    }

    function renderOrganOfferDetail(offer) {
      const donor = offer.donor || {};
      const logistics = offer.logistics || {};
      const serology = donor.serology || {};
      
      const wlPatients = patients.filter(p => p.state === "WL");
      const selectedCandidateId = demoState.organOfferSelectedCandidateId;
      const selectedCandidate = wlPatients.find(p => p.id === selectedCandidateId);
      
      const comp = calculateOrganCompatibility(donor, selectedCandidate);

      return `
        <div class="organ-offer-detail">
          <header class="organ-offer-detail-header">
            <div class="organ-offer-header-left">
              <button type="button" class="organ-offer-back" data-organ-offers-back>← Zpět na seznam</button>
              <div class="organ-offer-header-info">
                <h2>Nabídka ${offer.code}</h2>
                <p class="organ-offer-detail-sub">
                  Přijata ${offer.receivedAt} · Vyprší za ${offer.expiresInMin ?? "?"} min
                </p>
              </div>
            </div>
            <div class="organ-offer-header-actions">
              <button type="button" class="btn secondary btn-with-icon" data-edit-organ-offer="${offer.id}">
                ${renderMonoIcon("edit", "mono-icon")}
                Upravit
              </button>
              <button type="button" class="btn btn-primary organ-offer-chat-btn-highlight" data-toggle-organ-offer-chat="${offer.id}">
                ${renderMonoIcon("communication", "mono-icon")}
                Chat k nabídce
                ${(offer.thread || []).length ? `<span class="organ-offer-chat-badge">${(offer.thread || []).length}</span>` : ""}
              </button>
            </div>
          </header>

          <div class="grid cols-2 organ-offer-detail-grid">
            <div class="organ-offer-detail-col">
              <div class="card">
                <div class="card-header">
                  <h3>1. Údaje o dárci - ${offer.code}</h3>
                </div>
                <table class="summary-table organ-offer-kv">
                  <tbody>
                    <tr><th>Věk / pohlaví</th><td>${donor.age} let / ${donor.sex}</td></tr>
                    <tr><th>Výška / hmotnost</th><td>${donor.heightCm} cm / ${donor.weightKg} kg</td></tr>
                    <tr><th>Krevní skupina</th><td>${donor.bloodGroup}</td></tr>
                    <tr><th>Příčina úmrtí</th><td>${donor.causeOfDeath || "-"}</td></tr>
                    <tr><th>Doba ventilace</th><td>${donor.ventilationDays ?? "-"} dní</td></tr>
                    <tr><th>Pack-years</th><td>${donor.packYears ?? "-"} PY</td></tr>
                    <tr><th>PaO2 / FiO2 (Horowitz)</th><td>${donor.pao2Fio2 ?? "-"} mmHg</td></tr>
                    <tr><th>Plán odběru</th><td>${donor.collectionPlan || "-"}</td></tr>
                    <tr><th>Odběrová nemocnice</th><td>${donor.collectionHospital || "-"}</td></tr>
                  </tbody>
                </table>
                <div class="organ-offer-reports">
                  <p><strong>RTG hrudníku:</strong> ${donor.chestXray || "-"}</p>
                  <p><strong>Bronchoskopie:</strong> ${donor.bronchoscopy || "-"}</p>
                  <p><strong>Mikrobiologie:</strong> ${donor.microbiology || "-"}</p>
                </div>
                <div class="organ-offer-serology">
                  <strong>Sérologie dárce</strong>
                  <div class="organ-serology-tags">
                    ${renderOrganOfferSerologyTag("HIV", serology.hiv)}
                    ${renderOrganOfferSerologyTag("HBV", serology.hbv)}
                    ${renderOrganOfferSerologyTag("HCV", serology.hcv)}
                    ${renderOrganOfferSerologyTag("CMV", serology.cmv)}
                    ${renderOrganOfferSerologyTag("EBV", serology.ebv)}
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-header"><h3>Logistika</h3></div>
                <table class="summary-table organ-offer-kv">
                  <tbody>
                    <tr><th>Odhadovaná studená ischemie</th><td>${offer.coldIschemiaMin ?? "-"} min</td></tr>
                    <tr><th>Tým odběru</th><td>${logistics.collectionTeam || "-"}</td></tr>
                    <tr><th>Platnost do</th><td>${logistics.validUntil || "-"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="organ-offer-detail-col">
              <div class="card">
                <div class="card-header"><h3>2. Výběr kandidáta z čekací listiny</h3></div>
                <div class="organ-candidates-selection">
                  ${wlPatients.length ? wlPatients.map((candidate) => {
                    const pBG = candidate.bloodGroup || (candidate.demographics?.bloodType + candidate.demographics?.rh) || "";
                    const isBGCompatible = checkBloodGroupCompatibility(donor.bloodGroup, pBG);
                    return `
                      <button type="button" class="organ-candidate-card ${selectedCandidateId === candidate.id ? "is-selected" : ""}" data-organ-candidate-id="${candidate.id}">
                        <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                          <strong>${candidate.name}</strong>
                          ${isBGCompatible ? '<span style="color:#1f7a45; font-size:11px; font-weight:bold;">✓ ABO kompatibilní</span>' : ''}
                        </div>
                        <p>${candidate.diagnosisShort || candidate.diagnosis}</p>
                        <p class="organ-candidate-meta">${pBG} · ${candidate.demographics?.heightCm || candidate.heightCm} cm</p>
                      </button>
                    `;
                  }).join("") : '<p class="organ-offers-empty">Žádní kandidáti na WL.</p>'}
                </div>
              </div>

              <div class="card ${!selectedCandidate ? "organ-compat-card--empty" : ""}">
                <div class="card-header"><h3>3. Kontrola kompatibility pro výběr</h3></div>
                ${comp ? `
                  <ul class="organ-compat-list">
                    <li class="${comp.abo.ok ? "organ-compat-ok" : "organ-compat-fail"}">${comp.abo.ok ? "✓" : "✗"} ${comp.abo.label}</li>
                    <li class="${comp.size.ok ? "organ-compat-ok" : "organ-compat-warn"}">${comp.size.ok ? "✓" : "⚠"} ${comp.size.label}</li>
                    <li class="${comp.age.ok ? "organ-compat-ok" : "organ-compat-warn"}">${comp.age.ok ? "✓" : "⚠"} ${comp.age.label}</li>
                  </ul>
                  ${comp.warnings.length ? `
                    <div class="organ-compat-warnings">
                      <strong>SÉROLOGICKÁ UPOZORNĚNÍ</strong>
                      ${comp.warnings.map((item) => `<p class="organ-compat-warn">⚠ ${item}</p>`).join("")}
                    </div>
                  ` : ""}
                  <div class="organ-compat-overall ${comp.overall.includes("Vhodná") ? "organ-compat-overall--ok" : "organ-compat-overall--warn"}">
                    <strong>Celkové vyhodnocení</strong>
                    <p>${comp.overall}</p>
                  </div>
                ` : `
                  <div class="organ-compat-placeholder">
                    <p>Vyberte kandidáta ze seznamu výše pro zobrazení kompatibility.</p>
                  </div>
                `}
              </div>

              <div class="card">
                <div class="card-header"><h3>4. Rozhodnutí</h3></div>
                <div class="organ-offer-actions">
                  <button type="button" class="btn organ-offer-accept" ${!selectedCandidate ? "disabled" : ""} id="organOfferAcceptBtn">
                    ${selectedCandidate ? `Přijmout pro ${selectedCandidate.name}` : "Vyberte kandidáta"}
                  </button>
                  <div class="organ-offer-reject">
                    <input type="text" class="organ-offer-reject-input" id="organOfferRejectReason" placeholder="Důvod odmítnutí…">
                    <button type="button" class="btn danger-text" id="organOfferRejectBtn">Odmítnout nabídku</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p class="organ-offer-disclaimer">
            Kontrola kompatibility je algoritmický návrh na základě dostupných dat - konečné rozhodnutí vždy patří klinickému týmu.
          </p>
        </div>
      `;
    }

    function handleOrganOfferAccept() {
      const offer = selectedOrganOffer();
      const candidateId = demoState.organOfferSelectedCandidateId;
      const candidate = patients.find((p) => p.id === candidateId);
      if (!offer || !candidate) return;

      const now = formatDemoTimestamp();
      offer.status = "accepted";
      offer.archiveStatus = "archived";
      offer.handledAt = now;
      offer.handledFor = candidate.name;

      demoState.audit.unshift(`${now} - Nabídka ${offer.code} přijata pro pacienta ${candidate.name}.`);
      demoState.organOfferId = null;
      demoState.organOfferSelectedCandidateId = null;

      render();
      showToast(`Nabídka ${offer.code} byla přijata pro ${candidate.name}.`);
    }

    function handleOrganOfferReject() {
      const offer = selectedOrganOffer();
      if (!offer) return;

      const reason = document.getElementById("organOfferRejectReason")?.value.trim() || "Bez udání důvodu";
      const now = formatDemoTimestamp();
      offer.status = "rejected";
      offer.archiveStatus = "archived";
      offer.handledAt = now;
      offer.rejectReason = reason;

      demoState.audit.unshift(`${now} - Nabídka ${offer.code} odmítnuta. Důvod: ${reason}.`);
      demoState.organOfferId = null;
      demoState.organOfferSelectedCandidateId = null;

      render();
      showToast(`Nabídka ${offer.code} byla odmítnuta.`);
    }

    function renderOrganOfferModal() {
      const isNew = !demoState.organOfferEditingId;
      const offer = isNew ? null : organOffers.find(o => o.id === demoState.organOfferEditingId);
      const donor = offer?.donor || {};
      const serology = donor.serology || {};
      const logistics = offer?.logistics || {};

      return `
        <div class="patient-edit-header">
          <h3 id="organOfferModalTitle">${isNew ? "Nová nabídka orgánu" : `Upravit nabídku ${offer.code}`}</h3>
          <button type="button" class="patient-edit-close" data-close-organ-offer-form aria-label="Zavřít">×</button>
        </div>
        <div class="patient-edit-body">
          <div class="grid-2" style="gap: 32px; align-items: start;">
            <div class="form-column">
              <h4 class="form-section-title">Základní údaje nabídky</h4>
              <div class="field">
                <label for="offerCode">Kód nabídky (KST)</label>
                <input id="offerCode" type="text" value="${offer?.code || ""}" placeholder="D-2026-XXX">
              </div>
              <div class="grid-2" style="gap: 16px;">
                <div class="field">
                  <label for="offerExpires">Vyprší za (min)</label>
                  <input id="offerExpires" type="number" value="${offer?.expiresInMin || 180}">
                </div>
                <div class="field">
                  <label for="offerColdIschemia">Studená ischemie (min)</label>
                  <input id="offerColdIschemia" type="number" value="${offer?.coldIschemiaMin || 300}">
                </div>
              </div>
              
              <h4 class="form-section-title" style="margin-top: 32px;">Údaje o dárci</h4>
              <div class="grid-2" style="gap: 16px;">
                <div class="field">
                  <label for="donorAge">Věk dárce</label>
                  <input id="donorAge" type="number" value="${donor.age || ""}">
                </div>
                <div class="field">
                  <label for="donorSex">Pohlaví</label>
                  <select id="donorSex">
                    <option value="muž" ${donor.sex === "muž" ? "selected" : ""}>muž</option>
                    <option value="žena" ${donor.sex === "žena" ? "selected" : ""}>žena</option>
                  </select>
                </div>
              </div>
              <div class="grid-2" style="gap: 16px;">
                <div class="field">
                  <label for="donorHeight">Výška (cm)</label>
                  <input id="donorHeight" type="number" value="${donor.heightCm || ""}">
                </div>
                <div class="field">
                  <label for="donorWeight">Hmotnost (kg)</label>
                  <input id="donorWeight" type="number" value="${donor.weightKg || ""}">
                </div>
              </div>
              <div class="field">
                <label for="donorBloodGroup">Krevní skupina</label>
                <select id="donorBloodGroup">
                  <option value="A+" ${donor.bloodGroup === "A+" ? "selected" : ""}>A+</option>
                  <option value="A-" ${donor.bloodGroup === "A-" ? "selected" : ""}>A-</option>
                  <option value="B+" ${donor.bloodGroup === "B+" ? "selected" : ""}>B+</option>
                  <option value="B-" ${donor.bloodGroup === "B-" ? "selected" : ""}>B-</option>
                  <option value="AB+" ${donor.bloodGroup === "AB+" ? "selected" : ""}>AB+</option>
                  <option value="AB-" ${donor.bloodGroup === "AB-" ? "selected" : ""}>AB-</option>
                  <option value="0+" ${donor.bloodGroup === "0+" ? "selected" : ""}>0+</option>
                  <option value="0-" ${donor.bloodGroup === "0-" ? "selected" : ""}>0-</option>
                </select>
              </div>
            </div>

            <div class="form-column">
              <h4 class="form-section-title">Klinické údaje a sérologie</h4>
              <div class="field">
                <label for="donorCauseOfDeath">Příčina úmrtí</label>
                <input id="donorCauseOfDeath" type="text" value="${donor.causeOfDeath || ""}">
              </div>
              <div class="grid-2" style="gap: 16px;">
                <div class="field">
                  <label for="donorVentilation">Dny ventilace</label>
                  <input id="donorVentilation" type="number" value="${donor.ventilationDays || ""}">
                </div>
                <div class="field">
                  <label for="donorHorowitz">Horowitz (PaO2/FiO2)</label>
                  <input id="donorHorowitz" type="number" value="${donor.pao2Fio2 || ""}">
                </div>
              </div>
              
              <div class="serology-section" style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #edf2f7;">
                <label style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">Sérologie (NEG / POZ)</label>
                <div class="grid-3" style="gap: 12px;">
                  ${["hiv", "hbv", "hcv", "cmv", "ebv"].map(key => `
                    <div class="field" style="margin-bottom: 0;">
                      <label style="font-size: 10px; margin-bottom: 4px;">${key.toUpperCase()}</label>
                      <select id="serology_${key}" style="height: 38px; padding: 4px 8px; font-size: 13px;">
                        <option value="neg" ${serology[key] === "neg" ? "selected" : ""}>NEG</option>
                        <option value="pos" ${serology[key] === "pos" ? "selected" : ""}>POZ</option>
                      </select>
                    </div>
                  `).join("")}
                </div>
              </div>

              <h4 class="form-section-title" style="margin-top: 32px;">Logistika</h4>
              <div class="field">
                <label for="logisticsHospital">Odběrová nemocnice</label>
                <input id="logisticsHospital" type="text" value="${donor.collectionHospital || ""}">
              </div>
              <div class="field">
                <label for="logisticsTeam">Tým odběru</label>
                <input id="logisticsTeam" type="text" value="${logistics.collectionTeam || "Tým FN Motol"}">
              </div>
            </div>
          </div>
          
          <div class="field" style="margin-top: 16px; margin-bottom: 0;">
            <label for="donorXray">RTG nález</label>
            <textarea id="donorXray" rows="3" placeholder="Popis nálezu na RTG hrudníku...">${donor.chestXray || ""}</textarea>
          </div>
        </div>
        <div class="patient-edit-footer">
          <button class="btn secondary" type="button" data-close-organ-offer-form>Zrušit</button>
          <button class="btn" type="button" data-save-organ-offer>${isNew ? "Vytvořit nabídku" : "Uložit změny"}</button>
        </div>
      `;
    }

    function openOrganOfferForm(offerId = null) {
      demoState.organOfferEditingId = offerId;
      demoState.organOfferFormOpen = true;
      render();
    }

    function closeOrganOfferForm() {
      demoState.organOfferEditingId = null;
      demoState.organOfferFormOpen = false;
      render();
    }

    function saveOrganOffer() {
      const isNew = !demoState.organOfferEditingId;
      const offerId = demoState.organOfferEditingId || `offer-${Date.now()}`;
      
      const newOffer = {
        id: offerId,
        code: document.getElementById("offerCode").value || `D-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        status: "new",
        archiveStatus: "active",
        receivedAt: formatDemoTimestamp(),
        expiresInMin: parseInt(document.getElementById("offerExpires").value) || 180,
        coldIschemiaMin: parseInt(document.getElementById("offerColdIschemia").value) || 300,
        donor: {
          age: parseInt(document.getElementById("donorAge").value) || 0,
          sex: document.getElementById("donorSex").value,
          heightCm: parseInt(document.getElementById("donorHeight").value) || 0,
          weightKg: parseInt(document.getElementById("donorWeight").value) || 0,
          bloodGroup: document.getElementById("donorBloodGroup").value,
          causeOfDeath: document.getElementById("donorCauseOfDeath").value,
          ventilationDays: parseInt(document.getElementById("donorVentilation").value) || 0,
          pao2Fio2: parseInt(document.getElementById("donorHorowitz").value) || 0,
          collectionHospital: document.getElementById("logisticsHospital").value,
          chestXray: document.getElementById("donorXray").value,
          serology: {
            hiv: document.getElementById("serology_hiv").value,
            hbv: document.getElementById("serology_hbv").value,
            hcv: document.getElementById("serology_hcv").value,
            cmv: document.getElementById("serology_cmv").value,
            ebv: document.getElementById("serology_ebv").value,
          }
        },
        logistics: {
          collectionTeam: document.getElementById("logisticsTeam").value,
          validUntil: formatDemoTimestamp(new Date(Date.now() + (parseInt(document.getElementById("offerExpires").value) || 180) * 60000))
        },
        candidates: [],
        thread: []
      };

      if (isNew) {
        organOffers.unshift(newOffer);
        demoState.audit.unshift(`${newOffer.receivedAt} - Byla vytvořena nová nabídka orgánu ${newOffer.code}.`);
      } else {
        const idx = organOffers.findIndex(o => o.id === offerId);
        if (idx !== -1) {
          organOffers[idx] = { ...organOffers[idx], ...newOffer, thread: organOffers[idx].thread };
        }
      }

      closeOrganOfferForm();
      showToast(isNew ? "Nabídka byla vytvořena." : "Změny byly uloženy.");
    }

    function wireOrganOffersOnce() {
      if (wireOrganOffersOnce.done) return;
      wireOrganOffersOnce.done = true;

      document.addEventListener("click", (event) => {
        const newOfferBtn = event.target.closest("[data-new-organ-offer]");
        if (newOfferBtn) {
          event.preventDefault();
          openOrganOfferForm();
          return;
        }

        const editOfferBtn = event.target.closest("[data-edit-organ-offer]");
        if (editOfferBtn) {
          event.preventDefault();
          openOrganOfferForm(editOfferBtn.dataset.editOrganOffer);
          return;
        }

        const closeFormBtn = event.target.closest("[data-close-organ-offer-form]");
        if (closeFormBtn) {
          event.preventDefault();
          closeOrganOfferForm();
          return;
        }

        const saveOfferBtn = event.target.closest("[data-save-organ-offer]");
        if (saveOfferBtn) {
          event.preventDefault();
          saveOrganOffer();
          return;
        }

        const selectOfferBtn = event.target.closest("[data-select-organ-offer]");
        if (selectOfferBtn) {
          event.preventDefault();
          demoState.organOfferId = selectOfferBtn.dataset.selectOrganOffer;
          render();
          return;
        }

        const backToOffersBtn = event.target.closest("[data-organ-offers-back]");
        if (backToOffersBtn) {
          event.preventDefault();
          demoState.organOfferId = null;
          demoState.organOfferSelectedCandidateId = null;
          render();
          return;
        }

        const acceptBtn = event.target.closest("#organOfferAcceptBtn");
        if (acceptBtn) {
          event.preventDefault();
          handleOrganOfferAccept();
          return;
        }

        const rejectBtn = event.target.closest("#organOfferRejectBtn");
        if (rejectBtn) {
          event.preventDefault();
          handleOrganOfferReject();
          return;
        }

        const candidateBtn = event.target.closest("[data-organ-candidate-id]");
        if (candidateBtn) {
          event.preventDefault();
          demoState.organOfferSelectedCandidateId = candidateBtn.dataset.organCandidateId;
          render();
          return;
        }
      });
    }

    function renderMonitoringWorkspace() {
      const monitoringPatients = patients.filter((p) => p.state === "PO_TX" && p.postTxPhase === "hospitalizace" && p.criticalCare);

      return `
        <div class="monitoring-workspace">
          <div class="monitoring-header">
            <div class="monitoring-header-info">
              <h2>Monitoring kritické péče</h2>
              <p>Reálný přehled pacientů na ARO a JIP po transplantaci plic.</p>
            </div>
          </div>
          
          <div class="monitoring-grid">
            ${monitoringPatients.length ? monitoringPatients.map((patient) => renderMonitoringCard(patient)).join("") : `
              <div class="empty-state card soft">
                <p>Aktuálně žádní pacienti v pooperační kritické péči.</p>
              </div>
            `}
          </div>
        </div>
      `;
    }

    function renderMonitoringCard(patient) {
      const cc = patient.criticalCare;
      const vitals = cc.vitals;
      const d = getPatientDemographics(patient);
      const isUrgent = patient.priority === "kritický stav" || patient.priority === "vysoká";

      return `
        <div class="monitoring-card card ${isUrgent ? "urgent" : ""}">
          <div class="monitoring-card-header">
            <div class="monitoring-card-title">
              <h3>${escapeHtml(patient.name)}</h3>
              <span class="monitoring-location">${escapeHtml(cc.location)}</span>
            </div>
            <div class="monitoring-header-right">
              ${d.frailtyScore ? `<span class="monitoring-frailty-badge" title="Frailty score">Frailty: ${escapeHtml(d.frailtyScore)}</span>` : ""}
              <div class="monitoring-status-pill ${cc.status.includes("sedaci") ? "sedated" : "awake"}">
                ${escapeHtml(cc.status)}
              </div>
            </div>
          </div>
          
          <div class="monitoring-card-body">
            <div class="monitoring-meta-row">
              <span class="monitoring-meta-item"><strong>Diagnóza:</strong> ${escapeHtml(patient.diagnosisShort)}</span>
              <span class="monitoring-meta-item"><strong>Tx datum:</strong> ${escapeHtml(patient.txDate)}</span>
            </div>
            
            <div class="monitoring-stats-grid">
              <div class="monitoring-stat-box">
                <label>Ventilace</label>
                <div class="monitoring-stat-value">${escapeHtml(cc.ventilation.type)}</div>
                <div class="monitoring-stat-detail">${escapeHtml(cc.ventilation.support)}</div>
                <div class="monitoring-stat-trend-wrap">
                  Trend: <span class="monitoring-stat-trend ${cc.ventilation.trend === "zlepšení" ? "up" : "stable"}">${cc.ventilation.trend}</span>
                </div>
              </div>
              
              <div class="monitoring-stat-box">
                <label>Podpora & Sedace</label>
                <div class="monitoring-stat-value ${cc.support.ecmo !== "ne" ? "critical" : ""}">ECMO: ${escapeHtml(cc.support.ecmo)}</div>
                <div class="monitoring-stat-detail">${escapeHtml(cc.support.circulatory)}</div>
                <div class="monitoring-stat-detail">${escapeHtml(cc.sedation)}</div>
              </div>
              
              <div class="monitoring-stat-box vitals">
                <label>Klíčové parametry</label>
                <div class="vitals-row">
                  <div class="vital-item">
                    <span class="vital-label">SpO₂</span>
                    <span class="vital-value ${vitals.spo2 < 94 ? "alert" : ""}">${vitals.spo2}%</span>
                  </div>
                  <div class="vital-item">
                    <span class="vital-label">PaO₂/FiO₂</span>
                    <span class="vital-value ${vitals.pao2fio2 < 200 ? "alert" : ""}">${vitals.pao2fio2}</span>
                  </div>
                  <div class="vital-item">
                    <span class="vital-label">MAP</span>
                    <span class="vital-value">${vitals.map} <small>mmHg</small></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="monitoring-card-footer">
              <span class="monitoring-update">Poslední data: ${escapeHtml(cc.lastUpdate)}</span>
              <button type="button" class="btn btn-text" data-select-patient="${patient.id}">
                Zobrazit detail
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function renderOrganOffersWorkspace() {
      const offer = selectedOrganOffer();
      if (offer) return renderOrganOfferDetail(offer);
      return renderOrganOffersList();
    }

    function renderReferringNetworkMap() {
      return `
        <div class="referring-map-card card">
          <div class="card-header">
            <h3>Mapa odesílání</h3>
            <p class="referring-map-hint">Google Maps · klikněte na pracoviště pro kontakty</p>
          </div>
          <div class="referring-map-stage">
            <div id="referringGoogleMap" class="referring-google-map" role="application" aria-label="Google mapa odesílajících pracovišť ČR a SR"></div>
            <div class="referring-map-legend">
              <strong>Objem odeslání / rok</strong>
              <div class="referring-map-legend-items">
                <span><i class="referring-legend-line referring-legend-line--thin"></i> ≤ 3</span>
                <span><i class="referring-legend-line referring-legend-line--mid"></i> 4 - 7</span>
                <span><i class="referring-legend-line referring-legend-line--thick"></i> 8+</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderReferringNetworkWorkspace() {
      const sites = referringNetwork.sites || [];
      const totalReferrals = sites.reduce((sum, site) => sum + (site.referrals12m || 0), 0);
      const countries = [...new Set(sites.map((site) => site.country).filter(Boolean))];
      const countryLabel = countries.includes("CZ") && countries.includes("SK") ? "ČR + SR" : countries.join(" + ");

      const metrics = [
        { value: sites.length, label: "Odesílajících pracovišť" },
        { value: totalReferrals, label: "Odeslání celkem (12 m.)" },
        { value: countryLabel, label: "Země" },
        { value: referringNetwork.center?.name || "FN Motol", label: "Centrum" }
      ];

      const topSites = [...sites].sort((a, b) => (b.referrals12m || 0) - (a.referrals12m || 0)).slice(0, 5);
      const maxReferrals = topSites[0]?.referrals12m || 1;

      return `
        <div class="referring-network-page">
          <header class="referring-network-header">
            <h2>Síť odesílajících pracovišť</h2>
            <p>Google mapa pokrytí programu transplantace plic v ČR a na Slovensku. Tloušťka spojnice odpovídá objemu odeslání za posledních 12 měsíců.</p>
          </header>

          <div class="referring-network-metrics">
            ${metrics.map((metric) => `
              <div class="referring-network-metric card soft">
                <strong>${metric.value}</strong>
                <span>${metric.label}</span>
              </div>
            `).join("")}
          </div>

          <div class="referring-network-body">
            ${renderReferringNetworkMap()}
            <div class="card referring-network-ranking">
              <div class="card-header"><h3>Největší odesílatelé</h3></div>
              <ul class="referring-ranking-list">
                ${topSites.map((site) => `
                  <li>
                    <button type="button" class="referring-ranking-item" data-referring-site="${site.id}">
                      <span class="referring-ranking-label">${site.city}</span>
                      <span class="referring-ranking-bar-wrap">
                        <span class="referring-ranking-bar" style="width: ${Math.round((site.referrals12m / maxReferrals) * 100)}%"></span>
                      </span>
                      <span class="referring-ranking-count">${site.referrals12m}</span>
                    </button>
                  </li>
                `).join("")}
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    function tabsForRole(roleId) {
      const tabsByRole = {
        coordinator: [
          { id: "overview", label: "Pacienti" },
          { id: "monitoring", label: "Monitoring" },
          { id: "organOffers", label: "Agenda orgánů" },
          { id: "referringNetwork", label: "Síť pracovišť" }
        ],
        ambulatory: [
          { id: "overview", label: "Moji pacienti" }
        ],
        txPulmo: [
          { id: "overview", label: "Pacienti" },
          { id: "monitoring", label: "Monitoring" },
          { id: "organOffers", label: "Agenda orgánů" },
          { id: "referringNetwork", label: "Síť pracovišť" }
        ],
        surgeon: [
          { id: "overview", label: "Pacienti" },
          { id: "monitoring", label: "Monitoring" },
          { id: "organOffers", label: "Agenda orgánů" },
          { id: "referringNetwork", label: "Síť pracovišť" }
        ],
        intensivist: [
          { id: "overview", label: "Pacienti" },
          { id: "monitoring", label: "Monitoring" },
          { id: "referringNetwork", label: "Síť pracovišť" }
        ],
        psychologist: [
          { id: "overview", label: "Pacienti" }
        ],
        rehab: [
          { id: "overview", label: "Pacienti" }
        ],
        patient: [
          { id: "overview", label: "Můj program" }
        ],
        admin: [
          { id: "admin-users", label: "Uživatelé", icon: "participants" },
          { id: "admin-codelists", label: "Číselníky", icon: "list" },
          { id: "admin-materials", label: "Materiály", icon: "box" },
          { id: "admin-faqs", label: "FAQ", icon: "help" },
          { id: "admin-handbooks", label: "Příručky", icon: "documents" },
          { id: "admin-audit", label: "Audit správy", icon: "audit" }
        ]
      };

      return tabsByRole[roleId] || tabsByRole.coordinator;
    }

    function patientName(patientId) {
      const patient = patients.find((item) => item.id === patientId);
      return patient ? patient.name : "Neznámý pacient";
    }

    function statusClass(level) {
      if (level === "kritická") return "critical";
      if (level === "varování") return "warn";
      return "info";
    }

    function phaseIndex(code) {
      return mainFlowPhases().findIndex((phase) => phase.code === code);
    }

    function statePillClass(state) {
      if (state === "PO_TX") return "ok";
      if (state === "WL") return "warn";
      if (state === "UKONCENO") return "neutral";
      return "info";
    }

    function postTxPhaseLabel(phase) {
      if (phase === "hospitalizace") return "Po transplantaci v hospitalizaci";
      return "V ambulantním sledování";
    }

    function patientJourneyLabel(patient) {
      if (patient?.state === "PO_TX") {
        return `${phaseLabel("PO_TX")} · ${postTxPhaseLabel(patient.postTxPhase)}`;
      }
      return phaseLabel(patient?.state);
    }

    function renderPostTxSubphase(patient) {
      if (patient.state !== "PO_TX") return "";

      const hospClass = patient.postTxPhase === "hospitalizace" ? "active" : "done";
      const ambClass = patient.postTxPhase === "ambulantni" ? "active" : "";

      return `
        <div class="card soft" style="margin-top: 14px; padding: 14px;">
          <h4 style="margin: 0 0 8px; font-size: 13px;">Sledování po transplantaci</h4>
          <p style="color: var(--muted); font-size: 13px; margin: 0 0 10px;">
            Transplantace je událost uvnitř stavu Po transplantaci. Datum výkonu, kontroly, domácí měření a follow-up jsou součásti tohoto stavu.
          </p>
          <div class="timeline branch" style="margin-top: 10px;">
            <div class="phase ${hospClass}">
              <code>hospitalizace</code>
              <span>Po transplantaci v hospitalizaci</span>
            </div>
            <div class="phase ${ambClass}">
              <code>ambulantni</code>
              <span>V ambulantním sledování</span>
            </div>
          </div>
          <div class="list" style="margin-top: 12px;">
            <div class="item">
              <div>
                <h4>Datum transplantace</h4>
                <p>${patient.txDate || "neuvedeno"}</p>
              </div>
              <span class="pill ok">${postTxPhaseLabel(patient.postTxPhase)}</span>
            </div>
          </div>
        </div>
      `;
    }

    function renderEvaluationSteps(patient) {
      if (!patient.evaluationSteps?.length) return "";

      return `
        <div class="card soft" style="margin-top: 14px; padding: 14px;">
          <h4 style="margin: 0 0 10px; font-size: 13px;">Kroky uvnitř posuzování</h4>
          <p style="color: var(--muted); font-size: 12px; margin: 0 0 10px;">Odeslání, převzetí, vyšetření a rozhodnutí týmu jsou kroky uvnitř stavu V posuzování.</p>
          <div class="list">
            ${patient.evaluationSteps.map((step) => `
              <div class="item">
                <div>
                  <h4>${step.label}</h4>
                  <p>${step.date || step.detail || ""}</p>
                </div>
                <span class="pill ${step.done ? "ok" : ""}">${step.done ? "hotovo" : "plánováno"}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function userInitials(name) {
      const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean);
      if (!parts.length) return "?";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    function getUserAvatarUrl(user) {
      return `/static/img/avatars/${user.id}.jpg`;
    }

    function openDemoRoleModal(clientX, clientY) {
      demoState.userMenuOpen = true;
      demoState.demoRoleAnchor = {
        x: clientX ?? getDemoRoleAnchorFallback().x,
        y: clientY ?? getDemoRoleAnchorFallback().y
      };
      document.getElementById("demoRoleModal")?.classList.add("open");
      syncPageScrollLock();
      requestAnimationFrame(() => positionDemoRoleModal());
    }

    function closeDemoRoleModal() {
      demoState.userMenuOpen = false;
      demoState.demoRoleAnchor = null;
      document.getElementById("demoRoleModal")?.classList.remove("open");
      syncPageScrollLock();
    }

    function switchDemoUser(userId) {
      if (isAdminModeActive()) {
        window.LtxAdmin?.exitAdminMode?.();
      }
      const prevUser = activeUser();
      if (prevUser.roleId === "patient" && prevUser.patientId) {
        markPatientNotificationsRead(prevUser.patientId);
      }
      if (demoState.patientDetailOpen) {
        acknowledgePatientChats(demoState.patientId, prevUser.roleId);
      }

      const user = (window.LtxAdmin?.getUsers?.(false) || demoUsers).find((item) => item.id === userId)
        || demoUsers.find((item) => item.id === userId)
        || demoUsers[0];
      demoState.userId = user.id;
      demoState.role = user.roleId;
      if (user.roleId === "ambulatory") {
        const own = patients.filter((item) => item.referrerId === user.id);
        demoState.patientId = user.patientId || own[0]?.id || demoState.patientId;
      } else {
        demoState.patientId = user.patientId || user.defaultPatientId || demoState.patientId;
      }
      demoState.mainTab = tabsForRole(user.roleId)[0].id;
      demoState.patientTab = "overview";
      demoState.patientDetailOpen = false;
      demoState.organOfferId = null;
      demoState.referringSiteId = null;
      demoState.medicationEditingKey = null;
      demoState.examEditingKey = null;
      if (user.roleId === "patient") {
        const patient = patients.find((item) => item.id === demoState.patientId) || selectedPatient();
        demoState.patientPortalSection = getDefaultPatientPortalSection(patient);
      } else {
        ensureStaffMainTab(user);
      }
      demoState.userMenuOpen = false;
      demoState.ambNewReferral = false;
      demoState.ambEditReferral = false;
      demoState.handbookId = null;
      closeDemoRoleModal();
      closePersonalNotesModal();
      demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      render();
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 3200);
    }

    function renderMonoIcon(id, className = "mono-icon") {
      const stroke = "currentColor";
      const common = `class="${className}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
      const icons = {
        "daily-record": `<svg ${common}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"/></svg>`,
        medications: `<svg ${common}><path d="M8.5 8.5h7v7h-7z"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`,
        "care-plan": `<svg ${common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
        "record-history": `<svg ${common}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
        profile: `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>`,
        documents: `<svg ${common}><path d="M8 4h7l3 3v13H8z"/><path d="M15 4v4h4M11 12h5M11 16h5"/></svg>`,
        education: `<svg ${common}><path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z"/><path d="M6 11v4.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5V11"/></svg>`,
        "center-contact": `<svg ${common}><path d="M6.5 4h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4.5l-4 3v-3H6.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>`,
        settings: `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>`,
        overview: `<svg ${common}><circle cx="9" cy="9" r="2.5"/><circle cx="16" cy="10" r="2"/><path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5M14 19c0-1.8 1.5-3.5 4-3.5"/></svg>`,
        organOffers: `<svg ${common}><path d="M12 20s-6.5-4.2-6.5-9.5a4.5 4.5 0 0 1 8.2-2.6A4.5 4.5 0 0 1 18.5 10.5C18.5 15.8 12 20 12 20Z"/></svg>`,
        monitoring: `<svg ${common}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
        referringNetwork: `<svg ${common}><path d="M4 6h16v12H4z"/><path d="M8 10h3v6H8zM13 8h3v8h-3z"/></svg>`,
        info: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 8h.01"/></svg>`,
        logout: `<svg ${common}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M14 16l4-4-4-4M11 12h7"/></svg>`,
        calendar: `<svg ${common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
        communication: `<svg ${common}><path d="M6.5 5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11l-3.5 3v-3H6.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>`,
        help: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
        chart: `<svg ${common}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
        list: `<svg ${common}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
        box: `<svg ${common}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
        audit: `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
        settings: `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        participants: `<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3.5 18c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15 18c0-1.8 1.4-3.2 3.5-3.2"/></svg>`,
        send: `<svg ${common}><path d="M21 4 11 13"/><path d="m21 4-6.5 16L11 13 3 10.5 21 4Z"/></svg>`,
        pathway: `<svg ${common}><path d="M4 7h16M4 12h10M4 17h6"/><circle cx="18" cy="12" r="2"/><circle cx="14" cy="17" r="2"/></svg>`,
        edit: `<svg ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>`,
        trash: `<svg ${common}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1-2h10l1 2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        remove: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>`,
        globe: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>`,
        sparkle: `<svg ${common}><path d="m12 3 1.4 4.3L18 8.5l-4.6 1.2L12 14l-1.4-4.3L6 8.5l4.6-1.2L12 3Z"/><path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14Z"/><path d="M5 11l.7 2.1L8 14l-2.3.6L5 17l-.7-2.1L2 14l2.3-.6L5 11Z"/></svg>`,
        plus: `<svg ${common}><path d="M12 5v14M5 12h14"/></svg>`,
        download: `<svg ${common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`,
        ban: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M7 7l10 10"/></svg>`,
        "account-off": `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c0-2.8 2.9-5 6.5-5s6.5 2.2 6.5 5"/><path d="m5 5 14 14"/></svg>`,
        "account-on": `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c0-2.8 2.9-5 6.5-5s6.5 2.2 6.5 5"/><path d="m16 7 2 2 4-4"/></svg>`,
        lock: `<svg ${common}><rect x="6" y="11" width="12" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
        check: `<svg ${common}><path d="M20 6 9 17l-5-5"/></svg>`,
        circleCheck: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="m9 12 2.5 2.5L16 10"/></svg>`,
        close: `<svg ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
        phone: `<svg ${common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>`,
        ambulance: `<svg ${common}><path d="M10 10H6L4 16h2"/><path d="M18 10h-4l-2 6h8l-2-6Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10 6h4l2 4"/></svg>`,
        "contact-shield": `<svg ${common}><path d="M12 3 20 7v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z"/><path d="M12 8v4M12 16h.01"/></svg>`,
        "clock-hours": `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
        "clock-24": `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M8 3h8M8 21h8"/></svg>`,
        "contact-coord": `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M6 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/></svg>`,
        "contact-hotline": `<svg ${common}><path d="M12 3 20 7v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z"/><path d="M12 8v4M12 16h.01"/></svg>`,
        "contact-lungs": `<svg ${common}><path d="M9 4c-2 2-3 4.5-3 7.5S7 18 9 20"/><path d="M15 4c2 2 3 4.5 3 7.5S17 18 15 20"/><path d="M9 4c1.5 1 2.5 3 3 6.5S10.5 18 9 20"/><path d="M15 4c-1.5 1-2.5 3-3 6.5S13.5 18 15 20"/><path d="M12 6.5v11"/></svg>`,
        "contact-brain": `<svg ${common}><path d="M9 4a3 3 0 0 0-3 3v1a2 2 0 0 0 0 4v1a3 3 0 0 0 3 3"/><path d="M15 4a3 3 0 0 1 3 3v1a2 2 0 0 1 0 4v1a3 3 0 0 1-3 3"/><path d="M9 4c0 2 1.5 4 3 4s3-2 3-4"/><path d="M9 20c0-2 1.5-4 3-4s3 2 3 4"/></svg>`,
        "contact-rehab": `<svg ${common}><circle cx="12" cy="5" r="2"/><path d="M8 21v-6l2-2 2 2v6"/><path d="M16 21v-4l-2-1.5L12 17v4"/><path d="M10 13l2-3 2 3"/></svg>`
      };
      return icons[id] || icons.info;
    }

    function getDefaultPatientPortalSection(patient) {
      if (canPatientSubmitDailyRecord(patient)) return "daily-record";
      if (canShowPatientMedications(patient)) return "medications";
      return "care-plan";
    }

    function ensureStaffMainTab(user) {
      const roleId = isAdminModeActive() ? "admin" : user.roleId;
      const defaultTab = tabsForRole(roleId)[0]?.id || "overview";
      const allowed = [
        ...tabsForRole(roleId).map((tab) => tab.id),
        ...(isAdminModeActive() ? [] : (window.ProtocolHandbooks?.hasHandbooksForRole(user.roleId) ? ["handbooks"] : [])),
        ...(isAdminModeActive() || !canShowCenterContactNav(user) ? [] : ["center-contact"]),
        "settings"
      ];
      if (!allowed.includes(demoState.mainTab)) {
        demoState.mainTab = defaultTab;
        demoState.handbookId = null;
      }
      if (demoState.mainTab !== "handbooks") {
        demoState.handbookId = null;
      } else if (
        demoState.handbookId
        && !window.ProtocolHandbooks?.canAccessHandbook(demoState.handbookId, user.roleId)
      ) {
        demoState.handbookId = null;
      }
    }

    function ensurePatientPortalSection(patient) {
      const user = activeUser();
      if (user.roleId !== "patient") return;

      const allowed = [];
      if (canPatientSubmitDailyRecord(patient)) {
        allowed.push("daily-record", "record-history");
      }
      if (canShowPatientMedications(patient)) allowed.push("medications");
      allowed.push("care-plan", "profile", "education", "faq", "center-contact", "settings");

      if (!allowed.includes(demoState.patientPortalSection)) {
        demoState.patientPortalSection = getDefaultPatientPortalSection(patient);
      }
    }

    function getSidebarNavGroups(user) {
      const settingsFooter = [{ id: "settings", label: "Nastavení", icon: "settings" }];

      if (user.roleId === "patient") {
        const patient = selectedPatient();
        const items = [];

        if (canPatientSubmitDailyRecord(patient)) {
          items.push({ id: "daily-record", label: "Odeslat záznam", icon: "send" });
        }
        if (canShowPatientMedications(patient)) {
          items.push({ id: "medications", label: "Aktuální medikace", icon: "box" });
        }
        items.push({ id: "care-plan", label: "Plán kontroly", icon: "audit" });
        if (canPatientSubmitDailyRecord(patient)) {
          items.push({ id: "record-history", label: "Historie záznamů", icon: "list" });
        }
        items.push(
          { id: "education", label: "Edukace", icon: "documents" },
          { id: "faq", label: "FAQ pro pacienty", icon: "help" },
          { id: "center-contact", label: "Kontakty", icon: "communication" },
          { id: "profile", label: "Můj profil", icon: "participants" }
        );

        return {
          items,
          footer: settingsFooter,
          activeId: demoState.patientPortalSection || getDefaultPatientPortalSection(patient),
          navType: "patient"
        };
      }

      if (isAdminModeActive()) {
        const items = tabsForRole("admin").map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon
        }));
        const defaultTab = "admin-users";
        let activeId = demoState.mainTab || defaultTab;
        const allowedIds = [...items.map((item) => item.id), "settings"];
        if (!allowedIds.includes(activeId)) activeId = defaultTab;
        return {
          items,
          footer: settingsFooter,
          activeId,
          navType: "admin"
        };
      }

      const handbookMenuItem = window.ProtocolHandbooks?.hasHandbooksForRole(user.roleId)
        ? [{ id: "handbooks", label: "Příručky", icon: "documents" }]
        : [];

      const centerContactItem = canShowCenterContactNav(user)
        ? [{ id: "center-contact", label: "Kontakt na centrum", icon: "communication" }]
        : [];

      const items = [
        ...tabsForRole(user.roleId).map((tab) => ({ id: tab.id, label: tab.label })),
        ...handbookMenuItem,
        ...centerContactItem
      ];

      const defaultTab = tabsForRole(user.roleId)[0]?.id || "overview";
      let activeId = demoState.mainTab || defaultTab;
      const allowedIds = [
        ...tabsForRole(user.roleId).map((tab) => tab.id),
        ...handbookMenuItem.map((item) => item.id),
        ...centerContactItem.map((item) => item.id),
        "settings"
      ];
      if (!allowedIds.includes(activeId)) activeId = defaultTab;

      return {
        items,
        footer: settingsFooter,
        activeId,
        navType: "staff"
      };
    }

    function renderSidebarNavItems(items, activeId, navType) {
      return items.map((item) => `
        <li>
          <button
            type="button"
            class="sidebar-nav-item ${item.id === activeId ? "active" : ""}"
            data-sidebar-nav="${item.id}"
            data-sidebar-nav-type="${navType}"
            title="${escapeHtml(item.label)}"
            aria-current="${item.id === activeId ? "page" : "false"}"
          >
            <span class="sidebar-nav-icon" aria-hidden="true">${renderMonoIcon(item.icon || item.id)}</span>
            <span class="sidebar-nav-label">${escapeHtml(item.label)}</span>
          </button>
        </li>
      `).join("");
    }

    function renderAppSidebar() {
      const user = activeUser();
      const groups = getSidebarNavGroups(user);
      const collapsed = Boolean(demoState.sidebarCollapsed);
      const shell = document.getElementById("appShell");
      const sidebar = document.getElementById("appSidebar");

      if (shell) shell.classList.toggle("sidebar-collapsed", collapsed);
      if (!sidebar) return;

      sidebar.innerHTML = `
        <div class="sidebar-brand">
          <img class="sidebar-brand-logo" src="${LTXLINK_SIDEBAR_LOGO}" alt="LTxLink">
        </div>

        <nav class="sidebar-nav">
          <ul class="sidebar-nav-list">
            ${renderSidebarNavItems(groups.items, groups.activeId, groups.navType)}
          </ul>
        </nav>

        <div class="sidebar-footer-nav">
          <ul class="sidebar-nav-list">
            ${renderSidebarNavItems(groups.footer, groups.activeId, groups.navType)}
          </ul>
        </div>

        <div class="sidebar-user">
          <button type="button" class="sidebar-logout-btn" data-sidebar-logout title="Přepnout uživatele">
            ${renderMonoIcon("logout")}
            <span class="sidebar-logout-label">Odhlásit se</span>
          </button>
        </div>

        <div class="sidebar-bottom">
          <button
            type="button"
            class="sidebar-collapse-btn"
            data-toggle-sidebar
            aria-expanded="${!collapsed}"
            aria-label="${collapsed ? "Rozbalit menu" : "Sbalit menu"}"
            title="${collapsed ? "Rozbalit menu" : "Sbalit menu"}"
          >
            ${renderSidebarCollapseIcon(collapsed)}
          </button>
        </div>
      `;
    }

    function renderSidebarCollapseIcon(collapsed) {
      if (collapsed) {
        return `
          <svg class="sidebar-collapse-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.75"></rect>
            <path d="M9.5 4.5v15" stroke="currentColor" stroke-width="1.75"></path>
            <path d="M13.5 12H18.5M16 9.5L18.5 12L16 14.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        `;
      }

      return `
        <svg class="sidebar-collapse-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.75"></rect>
          <path d="M9.5 4.5v15" stroke="currentColor" stroke-width="1.75"></path>
          <path d="M18.5 12H13.5M16 9.5L13.5 12L16 14.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `;
    }

    function renderShell() {
      const user = activeUser();
      demoState.role = activeRoleId();

      const switchUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
      const userMenuList = document.getElementById("userMenuList");
      userMenuList.innerHTML = switchUsers.map((item) => {
        const role = roleById(item.roleId);
        return `
          <button class="user-menu-item ${item.id === demoState.userId ? "active" : ""}" type="button" data-switch-user="${item.id}">
            <img class="user-menu-item-avatar" src="${getUserAvatarUrl(item)}" alt="">
            <span class="user-menu-item-body">
              <strong>${item.name}</strong>
              <span>${role.name} · ${item.workplace}</span>
            </span>
          </button>
        `;
      }).join("");

      const demoRoleModal = document.getElementById("demoRoleModal");
      if (demoRoleModal) {
        demoRoleModal.classList.toggle("open", Boolean(demoState.userMenuOpen));
        if (demoState.userMenuOpen) {
          requestAnimationFrame(() => positionDemoRoleModal());
        }
      }

      updatePersonalNotesButtonState();
    }

    function phaseLabel(code) {
      const phase = phases.find((item) => item.code === code);
      return phase ? phase.label : code;
    }

    function renderMetrics() {
      const metricsEl = document.getElementById("metrics");
      const user = activeUser();

      if (user.roleId === "ambulatory" || user.roleId === "patient" || user.roleId === "coordinator" || isClinicalTeamViewer()) {
        metricsEl.innerHTML = "";
        metricsEl.hidden = true;
        return;
      }

      metricsEl.hidden = false;
      const waitlistCount = patients.filter((patient) => patient.state === "WL").length;
      const followCount = patients.filter((patient) => patient.state === "PO_TX").length;
      const evaluatingCount = patients.filter((patient) => patient.state === "POSUZOVANI").length;
      const openAlerts = demoState.alerts.filter((alert) => alert.status !== "vyřešeno").length;

      document.getElementById("metrics").innerHTML = [
        { value: patients.length, label: "pacientů v demo datech" },
        { value: evaluatingCount, label: "v posuzování" },
        { value: waitlistCount, label: "aktivně na čekací listině" },
        { value: followCount, label: "po transplantaci ve sledování" },
        { value: openAlerts, label: "otevřené informativní podněty" }
      ].map((metric) => `
        <div class="metric">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </div>
      `).join("");
    }

    function renderTimeline(patient) {
      if (patient.state === "UKONCENO") {
        return `
          <div class="timeline branch">
            <div class="phase done">
              <code>POSUZOVANI</code>
              <span>V posuzování</span>
            </div>
            <div class="phase active">
              <code>UKONCENO</code>
              <span>${patient.terminationReason || phaseLabel("UKONCENO")}</span>
            </div>
          </div>
        `;
      }

      const current = phaseIndex(patient.state);
      return `
        <div class="timeline">
          ${mainFlowPhases().map((phase, index) => {
            const className = index < current ? "done" : index === current ? "active" : "";
            return `
              <div class="phase ${className}">
                <code>${phase.code}</code>
                <span>${phase.label}</span>
              </div>
            `;
          }).join("")}
        </div>
        ${patient.state === "POSUZOVANI" ? renderEvaluationSteps(patient) : ""}
        ${patient.state === "PO_TX" ? renderPostTxSubphase(patient) : ""}
      `;
    }

    function renderNotice() {
      return `
        <div class="notice">
          <strong>Informativní pováha systému</strong>
          Výpočty, trendy a podněty jsou orientační signál pro tým. Systém nestanovuje diagnózu, nedoporučuje léčbu a o dalším kroku rozhoduje zdravotník.
        </div>
      `;
    }

    function renderAlerts(filterPatientId = null) {
      const alerts = filterPatientId
        ? demoState.alerts.filter((alert) => alert.patientId === filterPatientId)
        : demoState.alerts;

      if (!alerts.length) {
        return '<div class="empty">Pro tento pohled nejsou žádné podněty.</div>';
      }

      return `
        <div class="list">
          ${alerts.map((alert) => `
            <div class="item alert-card" data-level="${alert.level}">
              <div>
                <h4>${alert.type} · ${patientName(alert.patientId)}</h4>
                <p>${alert.message}</p>
                <p><strong>Úroveň:</strong> ${alert.level} · <strong>Odpovědný:</strong> ${alert.owner} · <strong>Vznik:</strong> ${alert.created}</p>
                <p><strong>Disclaimer:</strong> informativní podnět, rozhoduje zdravotník.</p>
              </div>
              <div class="item-actions">
                <span class="pill ${statusClass(alert.level)}">${alert.level}</span>
                <span class="pill">${alert.status}</span>
                ${alert.status !== "v řešení" ? `<button class="btn ghost" type="button" data-alert-status="${alert.id}" data-next-status="v řešení">Převzít</button>` : ""}
                ${alert.status !== "vyřešeno" ? `<button class="btn secondary" type="button" data-alert-status="${alert.id}" data-next-status="vyřešeno">Vyřešit</button>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderPatientDetail(patient) {
      const tabs = [
        { id: "overview", label: "Přehled" },
        { id: "waitlist", label: "Čekací listina" },
        { id: "followup", label: "Po transplantaci" },
        { id: "documents", label: "Dokumenty a audit" }
      ];

      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${patient.name}</h3>
              <p>${patient.age} let · ${patient.city}, ${patient.country} · ${patient.diagnosis} · krevní skupina ${patient.bloodGroup}</p>
            </div>
            <span class="pill ${statePillClass(patient.state)}">${patientJourneyLabel(patient)}</span>
          </div>
          ${renderTimeline(patient)}
        </div>

        <div class="card">
          <div class="tabs">
            ${tabs.map((tab) => `
              <button class="tab ${demoState.patientTab === tab.id ? "active" : ""}" type="button" data-patient-tab="${tab.id}">${tab.label}</button>
            `).join("")}
          </div>
          ${renderPatientTab(patient)}
        </div>
      `;
    }

    function renderPatientHeader(patient) {
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${patient.name}</h3>
              <p>${patient.age} let · ${patient.city}, ${patient.country} · ${patient.diagnosis} · krevní skupina ${patient.bloodGroup}</p>
            </div>
            <span class="pill ${statePillClass(patient.state)}">${patientJourneyLabel(patient)}</span>
          </div>
          ${renderTimeline(patient)}
        </div>
      `;
    }

    function renderPatientTab(patient) {
      if (demoState.patientTab === "waitlist") {
        return renderWaitlistPatient(patient);
      }

      if (demoState.patientTab === "followup") {
        return renderFollowUp(patient);
      }

      if (demoState.patientTab === "documents") {
        return renderDocuments(patient);
      }

      return `
        <div class="grid cols-2">
          <div>
            <div class="card-header">
              <div>
                <h3>Role v aktuální fázi</h3>
                <p>Krátký přehled toho, kdo ma v teto fázi agendu a co systém drží pohromadě.</p>
              </div>
            </div>
            <div class="list">
              ${[
                ["Ambulantní pneumolog", "Vidí své odeslané pacienty a navazné sledování po transplantaci."],
                ["Koordinátor", "Přepíná stav, plánuje kroky a hlida frontu podnětu."],
                ["Transplantační pneumolog", "Posuzuje podklady, sleduje trendy a reaguje na podněty."],
                ["Pacient", "V relevantních fázích vidí plán, edukaci a zadává hlášení nebo měření."]
              ].map(([title, text]) => `
                <div class="item">
                  <div>
                    <h4>${title}</h4>
                    <p>${text}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          <div>
            <div class="card soft">
              <h3>Nejbližší úkoly a vyšetření</h3>
              <div class="list" style="margin-top: 14px;">
                ${renderExamItems(patient)}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function examVisitCategory(title) {
      if (/odběr|labor/i.test(title)) return "Laboratoř";
      if (/rehab|fyzio|cvič/i.test(title)) return "Rehabilitace";
      if (/eduk|seminář/i.test(title)) return "Klinická kontrola";
      return "Klinická kontrola";
    }

    function collectPatientSharedDocuments(patient) {
      return [];
    }

    function renderPatientEducationGrid(compact = false) {
      const gridClass = compact ? "edu-video-grid edu-video-grid-compact" : "edu-video-grid";

      return `
        <div class="${gridClass}">
          ${getPatientEducationVideos().map((video) => `
            <article class="edu-video-card">
              <div class="edu-video-thumb" aria-hidden="true">
                <span class="edu-video-play">▶</span>
              </div>
              <div class="edu-video-body">
                <p class="edu-video-meta">${video.category} · ${video.duration}</p>
                <h4>${video.title}</h4>
                <p class="edu-video-author">${video.author}</p>
                <p class="edu-video-desc">${video.description}</p>
                ${(video.attachments || []).length ? `
                  <div class="edu-video-attachments">
                    ${video.attachments.map((file) => `
                      <button type="button" class="btn ghost btn-compact" data-doc-download="${escapeHtml(file.id)}">
                        ${renderMonoIcon("download", "mono-icon inline-mono-icon")}
                        ${escapeHtml(file.description || file.name)}
                      </button>
                    `).join("")}
                  </div>
                ` : ""}
              </div>
            </article>
          `).join("")}
        </div>
      `;
    }

    function renderPatientRecordHistorySection(patient) {
      const records = getPatientMeasurements(patient).slice().reverse();

      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Historie záznamů</h2>
          <p class="patient-portal-page-sub">Přehled dříve odeslaných domácích měření a příznaků.</p>
          ${records.length ? renderDailyRecordsList(patient, records, { medicationAsPill: false }) : '<div class="empty">Zatím nejsou žádné odeslané záznamy.</div>'}
        </section>
      `;
    }

    function renderPatientProfileSection(patient) {
      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Profil pacienta</h2>
          <p class="patient-portal-page-sub">Základní údaje vedené transplantním centrem.</p>
          <table class="summary-table">
            <tbody>
              <tr><th>Jméno</th><td>${escapeHtml(patient.name)}</td></tr>
              <tr><th>Věk</th><td>${patient.age} let</td></tr>
              <tr><th>Bydliště</th><td>${escapeHtml(patient.city)}, ${escapeHtml(patient.country)}</td></tr>
              <tr><th>Diagnóza</th><td>${escapeHtml(patient.diagnosis)}</td></tr>
              <tr><th>Krevní skupina</th><td>${escapeHtml(patient.bloodGroup || "-")}</td></tr>
              <tr><th>Stav v programu</th><td>${escapeHtml(patientJourneyLabel(patient))}</td></tr>
              <tr><th>Odesílající lékař</th><td>${escapeHtml(patient.referrer || "-")}</td></tr>
            </tbody>
          </table>
        </section>
      `;
    }

    function renderPatientDocumentsSection(patient) {
      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Dokumenty</h2>
          <p class="patient-portal-page-sub">Připravené materiály a zprávy určené pro pacienta (ne surové týmové podklady).</p>
          ${renderPatientSharedReports(patient)}
        </section>
      `;
    }

    function renderPatientEducationSection(patient) {
      const isEvaluating = patient.state === "POSUZOVANI";
      const isPostTx = patient.state === "PO_TX";
      const eduSub = isEvaluating
        ? "Obecné informace o transplantním programu."
        : isPostTx
          ? "Materiály pro režim po transplantaci."
          : "Materiály a videa od týmu pro období na čekací listině.";

      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Edukace</h2>
          <p class="patient-portal-page-sub">${eduSub}</p>
          ${patient.educationProgress != null ? `
            <p style="margin:0 0 16px;font-size:13px;color:var(--muted);">
              Váš průběh edukace: <strong>${patient.educationProgress} %</strong>
            </p>
          ` : ""}
          ${renderPatientEducationGrid(false)}
        </section>
      `;
    }

    function renderPatientFaqSection(patient) {
      const stateFaqs = faqs.filter((f) => f.state === patient.state);
      const isEvaluating = patient.state === "POSUZOVANI";
      const isPostTx = patient.state === "PO_TX";
      const faqSub = isEvaluating
        ? "Často kladené dotazy k procesu posuzování a zařazování."
        : isPostTx
          ? "Dotazy k režimu a životu po transplantaci."
          : "Dotazy k období na čekací listině a přípravě na výkon.";

      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">FAQ pro pacienty</h2>
          <p class="patient-portal-page-sub">${faqSub}</p>
          <div class="patient-faq-list" style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px;">
            ${stateFaqs.length ? stateFaqs.map((faq) => `
              <div class="card soft patient-faq-item" style="padding: 20px;">
                <strong style="display: block; margin-bottom: 10px; font-size: 16px; color: var(--text);">${escapeHtml(faq.question)}</strong>
                <p style="margin: 0; font-size: 15px; color: var(--muted); line-height: 1.6;">${escapeHtml(faq.answer)}</p>
              </div>
            `).join("") : `
              <div class="card soft" style="padding: 24px; text-align: center; color: var(--muted);">
                Zatím zde nejsou žádné dotazy pro vaši aktuální fázi.
              </div>
            `}
          </div>
        </section>
      `;
    }

    function renderPatientCarePlanSection(patient) {
      const isEvaluating = patient.state === "POSUZOVANI";
      const isPostTx = patient.state === "PO_TX";
      const planSub = isEvaluating
        ? "Termín příjmu do centra a plánovaná vyšetření."
        : isPostTx
          ? "Naplánované kontroly a návštěvy po transplantaci."
          : "Plánovaná vyšetření v období přípravy na čekací listině.";

      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Plán kontroly</h2>
          <p class="patient-portal-page-sub">${planSub}</p>
          <div class="card soft" style="margin-top:16px;">
            ${renderPatientPlannedVisits(patient)}
          </div>
        </section>
      `;
    }

    function renderCenterContactSection() {
      const user = activeUser();
      const isAmbulatory = user.roleId === "ambulatory";
      const emergency = isAmbulatory ? ambulatoryEmergencyContact : patientEmergencyContact;
      const contacts = isAmbulatory ? ambulatoryCenterContacts : patientCenterContacts;

      if (isPatientUser()) {
        return renderPatientContactsPage(emergency, contacts);
      }

      return `
        <section class="card patient-portal-section">
          <h2 class="patient-portal-page-title">Kontakt na centrum</h2>
          <p class="patient-portal-page-sub">Linky pro konzultaci s transplantním centrem FN Motol.</p>
          ${renderPatientContactsBody(emergency, contacts)}
        </section>
      `;
    }

    function phoneTelHref(phone) {
      return `tel:${String(phone || "").replace(/\s/g, "")}`;
    }

    function renderContactCallButton(phone, { urgent = false, compact = false } = {}) {
      const className = [
        "contact-call-btn",
        urgent ? "contact-call-btn--urgent" : "contact-call-btn--ghost",
        compact ? "contact-call-btn--compact" : ""
      ].filter(Boolean).join(" ");

      return `
        <a
          href="${phoneTelHref(phone)}"
          class="${className}"
        >
          ${renderMonoIcon("phone", "mono-icon contact-call-btn-icon")}
          Zavolat
        </a>
      `;
    }

    function renderPatientContactsBody(emergency, contacts) {
      return `
        <div class="contacts-emergency-card">
          <div class="contacts-emergency-main">
            <span class="contacts-emergency-icon" aria-hidden="true">
              ${renderMonoIcon("ambulance", "mono-icon contacts-emergency-icon-svg")}
            </span>
            <div class="contacts-emergency-copy">
              <p class="contacts-emergency-label">${escapeHtml(emergency.label)}</p>
              <a href="${phoneTelHref(emergency.phone)}" class="contacts-emergency-phone">${escapeHtml(emergency.phone)}</a>
            </div>
          </div>
          <div class="contacts-emergency-note">
            <span class="contacts-emergency-note-icon" aria-hidden="true">
              ${renderMonoIcon("contact-shield", "mono-icon contacts-emergency-note-icon-svg")}
            </span>
            <p>
              <strong>${escapeHtml(emergency.note)}</strong>
              ${escapeHtml(emergency.noteSub)}
            </p>
          </div>
          ${renderContactCallButton(emergency.phone, { urgent: true })}
        </div>

        <div class="contacts-grid">
          ${contacts.map((contact) => `
            <article class="contact-card${contact.variant === "hotline" ? " contact-card--hotline" : ""}">
              <span class="contact-card-icon contact-card-icon--${escapeHtml(contact.variant || "default")}" aria-hidden="true">
                ${renderMonoIcon(contact.icon, "mono-icon contact-card-icon-svg")}
              </span>
              <div class="contact-card-body">
                <h3>${escapeHtml(contact.label)}</h3>
                <a href="${phoneTelHref(contact.phone)}" class="contact-card-phone">${escapeHtml(contact.phone)}</a>
                ${contact.hours ? `
                  <p class="contact-card-hours${contact.variant === "hotline" ? " contact-card-hours--hotline" : ""}">
                    <span class="contact-card-hours-icon" aria-hidden="true">
                      ${renderMonoIcon(contact.variant === "hotline" ? "clock-24" : "clock-hours", "mono-icon contact-card-hours-icon-svg")}
                    </span>
                    ${escapeHtml(contact.hours)}
                  </p>
                ` : ""}
              </div>
              ${renderContactCallButton(contact.phone, { compact: true })}
            </article>
          `).join("")}
        </div>
      `;
    }

    function renderPatientContactsPage(emergency, contacts) {
      return `
        <section class="card patient-portal-section patient-contacts-page">
          <div class="patient-contacts-head">
            <span class="patient-contacts-head-icon" aria-hidden="true">
              ${renderMonoIcon("phone", "mono-icon patient-contacts-head-icon-svg")}
            </span>
            <div>
              <h2 class="patient-portal-page-title">Kontakt na centrum</h2>
              <p class="patient-portal-page-sub">
                Linky pro konzultaci s transplantním centrem FN Motol. Při akutních obtížích volejte pohotovost.
              </p>
            </div>
          </div>
          ${renderPatientContactsBody(emergency, contacts)}
        </section>
      `;
    }

    function renderPatientSettingsSection() {
      return renderUserSettingsSection(activeUser());
    }

    function renderStaffSettingsSection() {
      const user = activeUser();
      const adminBlock = hasAdminPermission(user) && !isAdminModeActive()
        ? `
          <div class="settings-row settings-row--admin">
            <span class="settings-row-text">
              <strong>Administrace systému</strong>
              <span class="settings-row-hint">Máte oprávnění ADMIN. Přepnout do režimu správy?</span>
            </span>
            <button type="button" class="btn warn btn-compact" data-admin-enter>Vstoupit</button>
          </div>
        `
        : "";
      return renderUserSettingsSection(user, adminBlock);
    }

    function renderPatientPortalSectionContent(patient, sectionId) {
      switch (sectionId) {
        case "daily-record":
          return renderPatientDailyRecordForm(patient);
        case "medications":
          return canShowPatientMedications(patient)
            ? renderPatientMedicationsCard(patient, { editable: false })
            : renderPatientCarePlanSection(patient);
        case "care-plan":
          return renderPatientCarePlanSection(patient);
        case "record-history":
          return renderPatientRecordHistorySection(patient);
        case "profile":
          return renderPatientProfileSection(patient);
        case "education":
          return renderPatientEducationSection(patient);
        case "faq":
          return renderPatientFaqSection(patient);
        case "center-contact":
          return renderCenterContactSection();
        case "settings":
          return renderPatientSettingsSection();
        default:
          return renderPatientDailyRecordForm(patient);
      }
    }

    function renderPatientPortal(patient) {
      ensurePatientPortalSection(patient);
      const section = demoState.patientPortalSection || getDefaultPatientPortalSection(patient);

      if (section === "center-contact" || section === "settings") {
        return `<div class="grid">${renderPatientPortalSectionContent(patient, section)}</div>`;
      }

      return `
        <div class="grid">
          ${renderPatientPortalSectionContent(patient, section)}
        </div>
      `;
    }

    function renderPatientPlannedVisits(patient) {
      const exams = getPatientVisiblePlannedExams(patient);
      const visitsTitle = patient.state === "POSUZOVANI" ? "Termín v centru" : "Plánované návštěvy";

      if (!exams.length) {
        return `
          <div class="visit-plan-head">
            <h3 style="margin:0;font-size:15px;display:flex;align-items:center;gap:8px;">
              <span class="inline-mono-icon" aria-hidden="true">${renderMonoIcon("calendar")}</span>
              ${visitsTitle}
            </h3>
            <span class="pill">0</span>
          </div>
          <p style="color:var(--muted);font-size:13px;margin-top:8px;">Zatím bez naplánovaných termínů. Centrum vás informuje emailem nebo telefonicky.</p>
        `;
      }

      return `
        <div class="visit-plan-head">
          <h3 style="margin:0;font-size:15px;display:flex;align-items:center;gap:8px;">
            <span class="inline-mono-icon" aria-hidden="true">${renderMonoIcon("calendar")}</span>
            ${visitsTitle}
          </h3>
          <span class="pill info">${exams.length}</span>
        </div>
        <div class="visit-list">
          ${exams.map((exam) => `
            <div class="visit-item visit-item-planned">
              <div>
                <h4>${escapeHtml(exam.title)}</h4>
                <p>${escapeHtml(exam.place)}${exam.note ? ` · ${escapeHtml(exam.note)}` : ""}</p>
                <span class="pill" style="margin-top:6px;font-size:10px;">${examVisitCategory(exam.title)}</span>
              </div>
              <div class="visit-item-side visit-item-when">
                <strong>${escapeHtml(exam.date)}</strong>
                <span>Plánováno</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderPatientHotlineContacts() {
      return renderPatientContactsBody(patientEmergencyContact, patientCenterContacts);
    }

    function renderPatientSharedReports(patient) {
      const docs = collectPatientSharedDocuments(patient);

      if (!docs.length) {
        return '<div class="empty" style="margin-top:14px;">Zatím bez sdílených zpráv a dokumentů.</div>';
      }

      return `
        <div class="list" style="margin-top:14px;">
          ${docs.map((doc) => `
            <div class="item">
              <div>
                ${doc.isNote ? `
                  <p style="margin:0;color:var(--muted);font-size:12px;">${escapeHtml(doc.source)}${doc.date ? ` · ${escapeHtml(doc.date)}` : ""}</p>
                  <h4 style="margin-top:4px;">Poznámka od týmu</h4>
                  <p style="margin:4px 0 0;font-size:13px;line-height:1.45;">${escapeHtml(doc.noteBody || "")}</p>
                ` : `
                  <h4>${escapeHtml(doc.name)}</h4>
                  <p>${escapeHtml(doc.source)}${doc.date ? ` · ${escapeHtml(doc.date)}` : ""}${doc.size ? ` · ${escapeHtml(doc.size)}` : ""}</p>
                `}
              </div>
              ${doc.isNote ? "" : `<button class="btn ghost" type="button" data-doc-download="${doc.id || doc.name}">Stáhnout</button>`}
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderExamItems(patient) {
      const exams = getPatientVisiblePlannedExams(patient);
      if (!exams.length) {
        return '<div class="empty">Bez plánovaných vyšetření.</div>';
      }

      return exams.map((exam) => `
        <div class="item">
          <div>
            <h4>${escapeHtml(exam.title)}</h4>
            <p>${escapeHtml(exam.place)}${exam.note ? ` · ${escapeHtml(exam.note)}` : ""}</p>
          </div>
          <span class="pill">${escapeHtml(exam.date)}</span>
        </div>
      `).join("");
    }

    function renderWaitlistPatient(patient) {
      return `
        <div class="grid cols-2">
          <div class="grid">
            <div class="card soft">
              <div class="card-header">
                <div>
                  <h3>Čekací listina</h3>
                  <p>Status, čekací doba, opakovaná vyšetření a kontakt s centrem.</p>
                </div>
                <span class="pill warn">${patient.waitDays} dni</span>
              </div>
              <table class="summary-table">
                <tr><th>Status</th><td>${patient.priority}</td></tr>
                <tr><th>Diagnóza</th><td>${patient.diagnosis}</td></tr>
                <tr><th>Odesílající lékař</th><td>${patient.referrer}</td></tr>
                <tr><th>Edukace</th><td>${patient.educationProgress} % dokončeno</td></tr>
              </table>
            </div>
            <div class="card soft">
              <h3>Plánovaná vyšetření</h3>
              <div class="list" style="margin-top: 14px;">${renderExamItems(patient)}</div>
            </div>
            ${canShowPatientMedications(patient) ? renderPatientMedicationsCard(patient, { editable: canEditPatientMedications(patient) }) : ""}
          </div>
          <div class="grid">
            ${renderTeamDailyRecordsCard(patient)}
            <div class="card soft">
              <h3>Edukace a kontakty</h3>
              <div class="list" style="margin-top: 14px;">
                ${education.slice(0, 3).map((item) => `
                  <div class="item">
                    <div>
                      <h4>${item.title}</h4>
                      <p>${item.type} · ${item.audience}</p>
                    </div>
                    <span class="pill">${item.duration}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderFollowUp(patient) {
      const measurements = getPatientMeasurements(patient);
      const fevRows = measurements.filter((item) => item.fev1 != null);
      const hasMeasurements = measurements.length > 0;
      const hasFevTrend = fevRows.length > 0 && patient.baseline;
      return `
        <div class="grid cols-2">
          <div class="grid">
            ${renderNotice()}
            <div class="card soft">
              <div class="card-header">
                <div>
                  <h3>Trend FEV1 oproti baseline</h3>
                  <p>Baseline je v demu brána jako prumer dvou nejvyšších pooperačních hodnot.</p>
                </div>
                <span class="pill">${hasFevTrend ? `${patient.baseline.toFixed(2)} l baseline` : "bez měření"}</span>
              </div>
              ${hasFevTrend ? renderFevChart(patient) : '<div class="empty">Pacient zatím nemá domácí měření FEV1.</div>'}
            </div>
            ${canShowPatientMedications(patient) ? renderPatientMedicationsCard(patient, { editable: canEditPatientMedications(patient) }) : ""}
          </div>
          <div class="grid">
            ${renderTeamDailyRecordsCard(patient)}
            <div class="card soft">
              <h3>Podněty pacienta</h3>
              <div style="margin-top: 14px;">${renderAlerts(patient.id)}</div>
            </div>
          </div>
        </div>
      `;
    }

    function renderFevChart(patient) {
      const fevRows = getPatientMeasurements(patient).filter((item) => item.fev1 != null);
      const values = fevRows.map((item) => item.fev1);
      if (!values.length || !patient.baseline) return "";
      const max = Math.max(patient.baseline * 1.05, ...values);
      const min = Math.min(patient.baseline * 0.7, ...values);
      const width = 720;
      const height = 230;
      const pad = 34;
      const points = fevRows.map((item, index) => {
        const x = pad + (index * (width - pad * 2)) / (fevRows.length - 1 || 1);
        const y = height - pad - ((item.fev1 - min) / (max - min)) * (height - pad * 2);
        return { ...item, x, y };
      });
      const line = points.map((point) => `${point.x},${point.y}`).join(" ");
      const baselineY = height - pad - ((patient.baseline - min) / (max - min)) * (height - pad * 2);
      const warnY = height - pad - (((patient.baseline * 0.9) - min) / (max - min)) * (height - pad * 2);
      const criticalY = height - pad - (((patient.baseline * 0.8) - min) / (max - min)) * (height - pad * 2);

      return `
        <div class="chart-wrap">
          <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend FEV1">
            <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" fill="#ffffff" stroke="#d9e2ec"></rect>
            <line x1="${pad}" y1="${baselineY}" x2="${width - pad}" y2="${baselineY}" stroke="#1263a3" stroke-width="2" stroke-dasharray="6 6"></line>
            <line x1="${pad}" y1="${warnY}" x2="${width - pad}" y2="${warnY}" stroke="#b96b05" stroke-width="2" stroke-dasharray="5 5"></line>
            <line x1="${pad}" y1="${criticalY}" x2="${width - pad}" y2="${criticalY}" stroke="#b3261e" stroke-width="2" stroke-dasharray="5 5"></line>
            <polyline points="${line}" fill="none" stroke="#1263a3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
            ${points.map((point) => `
              <circle cx="${point.x}" cy="${point.y}" r="6" fill="#1263a3"></circle>
              <text x="${point.x}" y="${height - 10}" text-anchor="middle" class="chart-label">${point.date}</text>
            `).join("")}
            <text x="${pad + 6}" y="${baselineY - 7}" class="chart-label">baseline</text>
            <text x="${pad + 6}" y="${warnY - 7}" class="chart-label">varovný práh</text>
            <text x="${pad + 6}" y="${criticalY - 7}" class="chart-label">výraznější práh</text>
          </svg>
          <div class="legend">
            <span><i class="dot"></i> FEV1</span>
            <span><i class="dot warn"></i> orientační varovný práh</span>
            <span><i class="dot critical"></i> orientační výraznější práh</span>
          </div>
        </div>
      `;
    }

    function renderDocuments(patient) {
      return `
        <div class="grid cols-2">
          <div class="card soft">
            <div class="card-header">
              <div>
                <h3>Dokumenty pacienta</h3>
                <p>Přílohy a generované záznamy vázané na fázi pacienta.</p>
              </div>
            </div>
            <div class="list">
              ${patient.documents.map((doc) => `
                <div class="item">
                  <div>
                    <h4>${doc}</h4>
                    <p>Vázáno na stav ${patient.state}; přístup podle role a rozsahu dat.</p>
                  </div>
                  <span class="pill">PDF / příloha</span>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="card soft">
            <div class="card-header">
              <div>
                <h3>Audit a měkká brána</h3>
                <p>Ukázka logování přechodů, přístupu a override při chybějícím podkladu.</p>
              </div>
            </div>
            <button class="btn" type="button" data-open-override>Ukázat override při zařazení</button>
            <div class="list" style="margin-top: 14px;">
              ${demoState.audit.map((entry) => `
                <div class="item">
                  <div>
                    <h4>Audit záznam</h4>
                    <p>${entry}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderCoordinator() {
      const patient = selectedPatient();
      return `
        <div class="grid cols-2">
          <div class="grid">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3>Fronta práce koordinátora</h3>
                  <p>Koordinátor ridi tok, ale klinická rozhodnutí zůstávají u týmu.</p>
                </div>
                <span class="pill warn">${tasks.filter((task) => task.status !== "hotovo").length} úkoly</span>
              </div>
              <div class="list">
                ${tasks.map((task) => `
                  <div class="item">
                    <div>
                      <h4>${task.title}</h4>
                      <p>${patientName(task.patientId)} · ${task.owner} · termín ${task.due}</p>
                    </div>
                    <span class="pill">${task.status}</span>
                  </div>
                `).join("")}
              </div>
            </div>
            ${renderPatientDetail(patient)}
          </div>
          <div class="grid">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3>Čekací listina</h3>
                  <p>Přehled statusu, čekací doby a upozornění na zhoršení.</p>
                </div>
              </div>
              <div class="list">
                ${patients.filter((item) => ["WL", "PO_TX"].includes(item.state)).map((item) => `
                  <div class="item">
                    <div>
                      <h4>${item.name}</h4>
                      <p>${item.diagnosisShort} · ${item.waitDays} dní od zařazení · ${item.priority}</p>
                    </div>
                    <button class="btn ghost" type="button" data-select-patient="${item.id}">Otevřít</button>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="card">
              <div class="card-header">
                <div>
                  <h3>Fronta informativních podnětů</h3>
                  <p>Barva je jen vizuální kód; úroveň je vzdy pojmenovaná slovně.</p>
                </div>
              </div>
              ${renderNotice()}
              <div style="margin-top: 14px;">${renderAlerts()}</div>
            </div>
          </div>
        </div>
      `;
    }

    function renderTxPulmo() {
      return `
        <div class="grid cols-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Pacienti k posouzení a follow-up</h3>
                <p>Pohled transplantčního pneumologa spojuje podklady, trendy a podněty.</p>
              </div>
            </div>
            ${renderPatientDetail(selectedPatient())}
          </div>
          <div class="grid">
            <div class="card">
              <h3>Podněty k posouzení</h3>
              <div style="margin-top: 14px;">${renderAlerts()}</div>
            </div>
            <div class="card">
              <h3>Záznam výroku týmu</h3>
              <p style="color: var(--muted);">V MVP je zde pouze výsledek rozhodnutí, ne plný konziliární modul.</p>
              <div class="field-grid" style="margin-top: 14px;">
                <div class="field">
                  <label>Výrok</label>
                  <select><option>Zařadit na čekací listinu</option><option>Zamítnout</option></select>
                </div>
                <div class="field">
                  <label>Pacient</label>
                  <input value="${selectedPatient().name}">
                </div>
              </div>
              <div class="field" style="margin-top: 12px;">
                <label>Poznámka týmu</label>
                <textarea>Pacient splňuje indikační kritéria, doporučeno zařazení po administrativním doplnění podkladů.</textarea>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderPatientApp() {
      const current = selectedPatient();
      const patient = ["WL", "PO_TX"].includes(current.state) ? current : patients.find((item) => item.id === "p2");
      return `
        <div class="grid">
          ${renderPatientDetail(patient)}
          <div class="grid cols-3">
            <div class="card soft">
              <h3>Moje kontakty</h3>
              <div class="list" style="margin-top: 14px;">
                ${contacts.slice(0, 4).map((contact) => `
                  <div class="item">
                    <div>
                      <h4>${contact.name}</h4>
                      <p>${contact.role} · ${contact.contact}</p>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="card soft">
              <h3>Moje edukace</h3>
              <div class="list" style="margin-top: 14px;">
                ${education.map((item) => `
                  <div class="item">
                    <div>
                      <h4>${item.title}</h4>
                      <p>${item.type} · ${item.duration}</p>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="card soft">
              <h3>Dnesni úkoly</h3>
              <div class="list" style="margin-top: 14px;">
                <div class="item"><div><h4>Zadat domácí měření</h4><p>FEV1, teplota, SpO2, tlak, váha.</p></div><span class="pill warn">dnes</span></div>
                <div class="item"><div><h4>Potvrdit užití léku</h4><p>Ranní a večerní dávka imunosuprese.</p></div><span class="pill ok">${patient.medicationAdherence || 96} %</span></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderPsyRehab(roleType) {
      const isPsychologist = roleType === "psychologist";
      const title = isPsychologist ? "Psychologická agenda" : "Rehabilitace a prérehabilitaci";
      const description = isPsychologist
        ? "Psycholog vidí edukaci, přípravu pacienta a pacienty, u kterých má tým držet kontakt."
        : "Rehabilitační pracovník / Fyzioterapeut vidí cvičení, prérehabilitaci a navaznou rehabilitaci po transplantaci.";
      const content = isPsychologist
        ? education.filter((item) => item.title.includes("Zkušenosti") || item.title.includes("Jak probíhá"))
        : education.filter((item) => item.title.includes("cvičení") || item.title.includes("Dechová") || item.title.includes("návratu"));
      return `
        <div class="grid cols-2">
          <div class="card">
            <h3>${title}</h3>
            <p style="color: var(--muted);">${description}</p>
            <div class="list" style="margin-top: 14px;">
              ${(content.length ? content : education).map((item) => `
                <div class="item">
                  <div>
                    <h4>${item.title}</h4>
                    <p>${item.type} · ${item.audience} · ${item.duration}</p>
                  </div>
                  <button class="btn ghost" type="button" data-demo-action="education">Sdílet</button>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="card">
            <h3>Pacienti ke kontaktu</h3>
            <div class="list" style="margin-top: 14px;">
              ${patients.filter((patient) => ["WL", "PO_TX"].includes(patient.state)).map((patient) => `
                <div class="item">
                  <div>
                    <h4>${patient.name}</h4>
                    <p>${patientJourneyLabel(patient)} · edukace ${patient.educationProgress} %</p>
                  </div>
                  <button class="btn ghost" type="button" data-select-patient="${patient.id}">Otevřít</button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderSurgeon(roleType) {
      const txPatients = patients.filter((patient) => patient.state === "PO_TX");
      const patient = selectedPatient();
      const isIntensivist = roleType === "intensivist";
      return `
        <div class="grid cols-2">
          <div class="card">
            <h3>${isIntensivist ? "Časná pooperační péče" : "Záznam transplantace"}</h3>
            <p style="color: var(--muted);">V MVP jde jen o základní záznam výkonu uvnitř stavu Po transplantaci, ne detailní perioperační modul.</p>
            <div class="field-grid" style="margin-top: 14px;">
              <div class="field"><label>Pacient</label><input value="${patient.name}"></div>
              <div class="field"><label>Typ výkonu</label><input value="Bilaterální transplantace plic"></div>
              <div class="field"><label>Datum výkonu</label><input value="${patient.txDate || ""}"></div>
              <div class="field"><label>${isIntensivist ? "Odpovědný lékař JIP" : "Operatér"}</label><input value="${isIntensivist ? "MUDr. Karel Veselý" : "doc. MUDr. Petr Sima"}"></div>
            </div>
            <div class="field" style="margin-top: 12px;">
              <label>${isIntensivist ? "Stav po stabilizaci" : "Časný pooperační průběh"}</label>
              <textarea>${isIntensivist ? "Pacient extubován dle plánu, oběhově stabilní, pokračuje monitoring infekčních parametrů." : "Bez zásadních chirurgických komplikací, překlad na standardní oddělení po stabilizaci."}</textarea>
            </div>
          </div>
          <div class="card">
            <h3>Pacienti po výkonu</h3>
            <div class="list" style="margin-top: 14px;">
              ${txPatients.map((item) => `
                <div class="item">
                  <div>
                    <h4>${item.name}</h4>
                    <p>${patientJourneyLabel(item)} · ${item.summary}</p>
                  </div>
                  <button class="btn ghost" type="button" data-select-patient="${item.id}">Otevřít</button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderSinglePatientOverview(patient) {
      return `
        <div class="grid cols-2">
          <div class="grid">
            ${renderPatientHeader(patient)}
          </div>
          <div class="grid">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3>Co systém právě řeší</h3>
                  <p>Jeden pacientský kontext, aby bylo zřejmé, co vidí vybraná role.</p>
                </div>
              </div>
              <div class="list">
                <div class="item">
                  <div>
                    <h4>Aktuální fáze</h4>
                    <p>${patientJourneyLabel(patient)}</p>
                  </div>
                  <span class="pill">${patient.state}</span>
                </div>
                <div class="item">
                  <div>
                    <h4>Nejbližší plán</h4>
                    <p>${getPlannedExamsForPatient(patient)[0] ? `${getPlannedExamsForPatient(patient)[0].title}, ${getPlannedExamsForPatient(patient)[0].date}` : "Bez plánované kontroly."}</p>
                  </div>
                </div>
                <div class="item">
                  <div>
                    <h4>Odpovědnost role</h4>
                    <p>${roleById(demoState.role).note || ""}</p>
                  </div>
                </div>
              </div>
            </div>
            ${!isPatientUser() ? `
              <div class="card">
                <h3>Pacient v agendě</h3>
                <p style="color: var(--muted);">Klinická role si otevře jeden pracovní detail pacienta. Nejde o globální přepínání identity.</p>
                <div class="list" style="margin-top: 14px;">
                  ${patients.map((item) => `
                    <div class="item">
                      <div>
                        <h4>${item.name}</h4>
                        <p>${item.diagnosisShort} · ${patientJourneyLabel(item)} · ${item.priority}</p>
                      </div>
                      ${item.id === patient.id ? '<span class="pill ok">otevřeno</span>' : `<button class="btn ghost" type="button" data-select-patient="${item.id}">Otevřít</button>`}
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ""}
            <div class="card">
              <h3>Podněty pro tohoto pacienta</h3>
              <div style="margin-top: 14px;">${renderAlerts(patient.id)}</div>
            </div>
          </div>
        </div>
      `;
    }

    function renderPatientDataWorkspace(patient) {
      return `
        <div class="grid">
          ${renderPatientHeader(patient)}
          <div class="grid cols-2">
            <div class="grid">
              ${renderWaitlistPatient(patient)}
            </div>
            <div class="grid">
              ${renderFollowUp(patient)}
              ${renderDocuments(patient)}
            </div>
          </div>
        </div>
      `;
    }

    function renderSurgeryAction(patient, roleType) {
      const isIntensivist = roleType === "intensivist";
      return `
        <div class="grid cols-2">
          <div class="card">
            <h3>${isIntensivist ? "Časná pooperační péče" : "Záznam transplantace"}</h3>
            <p style="color: var(--muted);">V MVP jde jen o základní záznam výkonu uvnitř stavu Po transplantaci, ne detailní perioperační modul.</p>
            <div class="field-grid" style="margin-top: 14px;">
              <div class="field"><label>Pacient</label><input value="${patient.name}"></div>
              <div class="field"><label>Typ výkonu</label><input value="Bilaterální transplantace plic"></div>
              <div class="field"><label>Datum výkonu</label><input value="${patient.txDate || ""}"></div>
              <div class="field"><label>Podfáze</label><input value="${postTxPhaseLabel(patient.postTxPhase || "hospitalizace")}" readonly></div>
              <div class="field"><label>${isIntensivist ? "Odpovědný lékař JIP" : "Operatér"}</label><input value="${isIntensivist ? "MUDr. Karel Veselý" : "doc. MUDr. Petr Sima"}"></div>
            </div>
            <div class="field" style="margin-top: 12px;">
              <label>${isIntensivist ? "Stav po stabilizaci" : "Časný pooperační průběh"}</label>
              <textarea>${isIntensivist ? "Pacient extubován dle plánu, oběhově stabilní, pokračuje monitoring infekčních parametrů." : "Bez zásadních chirurgických komplikací, překlad na standardní oddělení po stabilizaci."}</textarea>
            </div>
            <button class="btn" type="button" data-demo-action="surgery">Uložit základní záznam</button>
          </div>
          ${renderPatientHeader(patient)}
        </div>
      `;
    }

    function renderRoleActions(patient) {
      if (demoState.role === "txPulmo") {
        return `
          <div class="grid cols-2">
            <div class="card">
              <h3>Záznam výroku týmu</h3>
              <p style="color: var(--muted);">V MVP je zde pouze výsledek rozhodnutí, ne plný konziliární modul.</p>
              <div class="field-grid" style="margin-top: 14px;">
                <div class="field">
                  <label>Výrok</label>
                  <select><option>Zařadit na čekací listinu</option><option>Zamítnout</option></select>
                </div>
                <div class="field"><label>Pacient</label><input value="${patient.name}"></div>
              </div>
              <div class="field" style="margin-top: 12px;">
                <label>Poznámka týmu</label>
                <textarea>Pacient splňuje indikační kritéria, doporučeno zařazení po administrativním doplnění podkladů.</textarea>
              </div>
              <button class="btn" type="button" data-demo-action="decision">Záznamenat výrok</button>
            </div>
            <div class="card">
              <h3>Podněty k posouzení</h3>
              <div style="margin-top: 14px;">${renderAlerts(patient.id)}</div>
            </div>
          </div>
        `;
      }

      if (demoState.role === "patient") {
        return `
          <div class="grid">
            ${renderWaitlistPatient(patient)}
            ${renderFollowUp(patient)}
          </div>
        `;
      }

      if (demoState.role === "psychologist") {
        return `
          <div class="grid cols-2">
            <div class="card">
              <h3>Psychologická příprava</h3>
              <p style="color: var(--muted);">Akce jsou vázané pouze na vybraného pacienta.</p>
              <div class="list" style="margin-top: 14px;">
                <div class="item"><div><h4>Naplánovat kontakt</h4><p>${patient.name} · edukace ${patient.educationProgress} %</p></div><button class="btn ghost" type="button" data-demo-action="psych">Naplánovat</button></div>
                <div class="item"><div><h4>Sdílet edukaci</h4><p>Zkušenosti pacienta po transplantaci a příprava na čekání.</p></div><button class="btn ghost" type="button" data-demo-action="education">Sdílet</button></div>
              </div>
            </div>
            ${renderPatientHeader(patient)}
          </div>
        `;
      }

      if (demoState.role === "rehab") {
        return `
          <div class="grid cols-2">
            <div class="card">
              <h3>Rehabilitace a prérehabilitaci</h3>
              <p style="color: var(--muted);">Cvičení a rehabilitační plán pro vybraného pacienta.</p>
              <div class="list" style="margin-top: 14px;">
                <div class="item"><div><h4>Aktualizovat cvičení</h4><p>Dechová cvičení a bezpečná aktivita podle fáze ${phaseLabel(patient.state)}.</p></div><button class="btn ghost" type="button" data-demo-action="rehab">Aktualizovat</button></div>
                <div class="item"><div><h4>Připomenout edukaci</h4><p>Video fyzioterapie a domácí plán.</p></div><button class="btn ghost" type="button" data-demo-action="education">Odeslat</button></div>
              </div>
            </div>
            ${renderPatientHeader(patient)}
          </div>
        `;
      }

      if (demoState.role === "surgeon") {
        return renderSurgeryAction(patient, "surgeon");
      }

      if (demoState.role === "intensivist") {
        return renderSurgeryAction(patient, "intensivist");
      }

      return `
        <div class="grid cols-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Akce koordinátora</h3>
                <p>Koordinátor přepíná stav, plánuje kroky a odbavuje frontu, ale klinicky nerozhoduje.</p>
              </div>
            </div>
            <div class="list">
              ${tasks.map((task) => `
                <div class="item">
                  <div>
                    <h4>${task.title}</h4>
                    <p>${patientName(task.patientId)} · ${task.owner} · termín ${task.due}</p>
                  </div>
                  <span class="pill">${task.status}</span>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="card">
            <h3>Workflow pro vybraného pacienta</h3>
            <div class="list" style="margin-top: 14px;">
              <div class="item"><div><h4>Přijmout / naplánovat</h4><p>Evidence příjmu a vyšetření v centru bez detailního checklistu.</p></div><button class="btn ghost" type="button" data-demo-action="plán">Naplánovat</button></div>
              <div class="item"><div><h4>Záznamenat výrok týmu</h4><p>Výrok týmu se promita do stavu, rozhodnutí nedela koordinátor.</p></div><button class="btn ghost" type="button" data-demo-action="decision">Záznamenat</button></div>
              <div class="item"><div><h4>Měkká brána</h4><p>Chybějící podklad lze prekrocit s povinnym oddůvodnením.</p></div><button class="btn" type="button" data-open-override>Override</button></div>
            </div>
          </div>
        </div>
      `;
    }

    function renderAlertsAuditWorkspace(patient) {
      return `
        <div class="grid cols-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Fronta informativních podnětů</h3>
                <p>Podněty jsou informativní, mají stav a odpovědnou osobu. O reakci rozhoduje člověk.</p>
              </div>
            </div>
            ${renderNotice()}
            <div style="margin-top: 14px;">${renderAlerts()}</div>
          </div>
          <div class="card">
            <h3>Audit vybraného kontextu</h3>
            <p style="color: var(--muted);">Změny stavu, override a přístupy se v produkčním systému logují.</p>
            <div class="list" style="margin-top: 14px;">
              <div class="item">
                <div>
                  <h4>Aktuální pacientský kontext</h4>
                  <p>${patient.name} · ${patient.diagnosis} · ${patientJourneyLabel(patient)}</p>
                </div>
              </div>
              ${demoState.audit.map((entry) => `
                <div class="item">
                  <div><h4>AuditEntry</h4><p>${entry}</p></div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderPatientEducationContacts(patient) {
      return `
        <div class="grid cols-2">
          <div class="card">
            <h3>Moje edukace</h3>
            <p style="color: var(--muted);">Obsah, ke kterému se pacient může vracet na čekací listině i po transplantaci.</p>
            <div class="list" style="margin-top: 14px;">
              ${education.map((item) => `
                <div class="item">
                  <div>
                    <h4>${item.title}</h4>
                    <p>${item.type} · ${item.audience} · ${item.duration}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="card">
            <h3>Moje kontakty</h3>
            <div class="list" style="margin-top: 14px;">
              ${contacts.map((contact) => `
                <div class="item">
                  <div>
                    <h4>${contact.name}</h4>
                    <p>${contact.role} · ${contact.contact}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderPatientContextContent(patient) {
      if (patient.state === "PO_TX") return renderFollowUp(patient);
      if (patient.state === "WL") return renderWaitlistPatient(patient);
      if (patient.state === "UKONCENO") {
        const terminationLabel = patient.teamDecision?.outcome || patient.terminationReason || "Nezařazen na čekací listinu";
        const terminationNote = patient.teamDecision?.note;
        return `
          <div class="card soft">
            <h3>Ukončení posuzování</h3>
            <p style="margin-top: 10px;"><strong>${terminationLabel}</strong></p>
            ${terminationNote && terminationNote !== terminationLabel ? `<p style="color: var(--muted); margin-top: 8px;">${terminationNote}</p>` : ""}
          </div>
        `;
      }
      return `
        <div class="grid">
          ${renderEvaluationSteps(patient)}
          <div class="card soft">
            <h3>Plánované kroky v centru</h3>
            <div class="list" style="margin-top: 14px;">${renderExamItems(patient)}</div>
          </div>
        </div>
      `;
    }

    function renderPatientWorkspace(patient) {
      return renderPatientPortal(patient);
    }

    function renderCurrentWorkspace() {
      const patient = selectedPatient();
      if (isAdminModeActive()) {
        return window.LtxAdmin.renderAdminWorkspace(demoState.mainTab);
      }
      if (demoState.role === "patient") return renderPatientWorkspace(patient);
      if (demoState.mainTab === "center-contact" && canShowCenterContactNav()) {
        return renderCenterContactSection();
      }
      if (demoState.mainTab === "settings") return renderStaffSettingsSection();
      if (demoState.mainTab === "monitoring") {
        if (demoState.patientDetailOpen && patient) {
          return renderStaffPatientDetailPage(patient);
        }
        return renderMonitoringWorkspace();
      }
      if (
        demoState.mainTab === "handbooks"
        && window.ProtocolHandbooks?.hasHandbooksForRole(demoState.role)
      ) {
        return window.ProtocolHandbooks.renderHandbooksWorkspace(demoState.role, demoState.handbookId);
      }
      if (demoState.role === "ambulatory") return renderAmbulatoryWorkspace(patient);
      if (demoState.mainTab === "organOffers" && canAccessOrganOffers()) {
        return renderOrganOffersWorkspace();
      }
      if (demoState.mainTab === "referringNetwork" && canAccessReferringNetwork()) {
        return renderReferringNetworkWorkspace();
      }
      if (demoState.role === "coordinator") return renderClinicalPatientsDashboard(patient, { canEditState: true });
      if (isClinicalTeamViewer()) return renderClinicalPatientsDashboard(patient, { canEditState: false });
      if (demoState.mainTab === "data") return renderPatientDataWorkspace(patient);
      if (demoState.mainTab === "actions") return renderRoleActions(patient);
      if (demoState.mainTab === "alerts") return renderAlertsAuditWorkspace(patient);
      return renderSinglePatientOverview(patient);
    }

    function setPageHeadingLine(id, text) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text || "";
      el.hidden = !text;
    }

    function renderPageHeadings() {
      const user = activeUser();
      const role = isAdminModeActive() ? roleById("admin") : roleById(user.roleId);

      document.getElementById("viewUserPhoto").src = getUserAvatarUrl(user);
      document.getElementById("viewTitle").textContent = user.name;
      setPageHeadingLine("viewRole", isAdminModeActive() ? `${role.name} (režim správy)` : role.name);
      setPageHeadingLine("viewWorkplace", user.workplace);
      setPageHeadingLine("viewPhone", user.phone);
      setPageHeadingLine("viewEmail", user.email);
      updatePersonalNotesButtonState();
    }

    function renderContent() {
      renderPageHeadings();
      const content = document.getElementById("content");
      content.innerHTML = renderCurrentWorkspace();
    }

    function openAmbReferralSentModal(patientName) {
      const title = document.getElementById("ambReferralSentTitle");
      const summary = document.getElementById("ambReferralSentSummary");
      if (title) title.textContent = "Odeslání bylo vytvořeno";
      if (summary) summary.textContent = `Pacient ${patientName} byl odeslán do transplantního centra FN Motol.`;
      document.getElementById("ambReferralSentModal")?.classList.add("open");
    }

    function closeAmbReferralSentModal() {
      document.getElementById("ambReferralSentModal")?.classList.remove("open");
    }

    function openExamCompleteDoneModal(examTitle, bucketLabel) {
      const summary = document.getElementById("examCompleteDoneSummary");
      if (summary) {
        summary.textContent =
          `Vyšetření „${examTitle}“ bylo dokončeno. Termín zmizí z plánu, závěr šel pacientovi a podklady jsou u fáze ${bucketLabel}.`;
      }
      const modal = document.getElementById("examCompleteDoneModal");
      if (!modal) return;
      modal.classList.remove("is-closing", "is-visible");
      modal.classList.add("open");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          modal.classList.add("is-visible");
        });
      });
    }

    function closeExamCompleteDoneModal() {
      const modal = document.getElementById("examCompleteDoneModal");
      if (!modal || !modal.classList.contains("open")) return;
      modal.classList.remove("is-visible");
      modal.classList.add("is-closing");
      modal.classList.remove("open");
      window.setTimeout(() => {
        modal.classList.remove("is-closing");
      }, 320);
    }

    function applyCoordinatorFlowState() {
      const patient = coordinatorFlowPatient();
      const targetState = document.getElementById("coordFlowNextState").value;
      const option = getCoordinatorFlowOption(patient, targetState);
      if (!option) return;

      const note = document.getElementById("coordFlowNote").value.trim();
      const txDateEl = document.getElementById("coordFlowTxDate");
      const txDate = txDateEl?.value.trim();
      const now = formatDemoTimestamp();
      const dateShort = now.split(/\s+/).slice(0, 2).join(" ");
      const user = activeUser();
      const oldState = patient.state;
      const bucket = option.bucket || "rozhodnutí";

      if (!option.sameState && targetState === oldState) {
        showToast("Vyberte jiný stav než aktuální.");
        return;
      }

      const phaseFiles = getPhaseEvidenceFiles(patient, bucket);
      const outboundDoc = findOutboundMessageDoc(patient, bucket);

      if (!phaseFiles.length) {
        showToast("U fáze zatím nejsou podklady. Tým je musí vložit během fáze.");
        return;
      }

      if (patient.referrerId && !outboundDoc) {
        showToast("Chybí zpráva pro odesílatele. Vložte ji během fáze jako typ „zpráva pro odesílatele“.");
        return;
      }

      if (isWaitlistPortalActivationTransition(patient, targetState)) {
        const portalEmail = getPatientPortalEmail(patient);
        if (!portalEmail || !isValidPatientEmail(portalEmail)) {
          showToast("Pacient nemá platný e-mail pro aktivaci portálu. Doplňte ho v odeslání nebo v údajích pacienta.");
          return;
        }
      }

      const docNames = phaseFiles.map((file) => file.name);
      const sharedDocumentId = outboundDoc?.id || null;
      let wlPortalResult = null;

      if (!option.sameState) {
        patient.state = targetState;

        if (targetState === "WL") {
          patient.teamDecision = {
            outcome: option.outcome || "Zařadit na čekací listinu",
            note,
            date: dateShort
          };
          if (!patient.waitDays) patient.waitDays = 1;
          patient.summary = note || "Pacient na čekací listině.";

          if (oldState === "POSUZOVANI") {
            wlPortalResult = window.LtxAdmin?.activatePatientPortalUser?.(patient, { activatedAt: now });
            if (wlPortalResult?.ok) {
              demoUsers = window.LtxAdmin?.getUsers?.(false) || demoUsers;
              const portalMessage = wlPortalResult.reactivated && !wlPortalResult.alreadyActive
                ? `Váš účet v pacientském portálu byl znovu aktivován. Přihlaste se e-mailem ${wlPortalResult.email}. Přístupové údaje vám přišly na tento e-mail.`
                : `Váš účet v pacientském portálu byl aktivován. Přihlaste se e-mailem ${wlPortalResult.email}. Přístupové údaje vám přišly na tento e-mail.`;
              pushPatientNotification(patient.id, portalMessage, "portal_access");
              demoState.audit.unshift(
                `${now} - Systém odeslal pacientovi ${patient.name} e-mail s přístupem do portálu (${wlPortalResult.email}).`
              );
            }
          }
        } else if (targetState === "UKONCENO") {
          if (option.outcome) {
            patient.teamDecision = {
              outcome: option.outcome,
              note,
              date: dateShort
            };
          }
          patient.terminationReason = option.outcome || "Posuzování ukončeno.";
          patient.summary = note || patient.terminationReason;
        } else if (targetState === "PO_TX") {
          patient.txDate = txDate || dateShort;
          patient.postTxPhase = patient.postTxPhase || "hospitalizace";
          patient.summary = note || `Transplantace proveděna ${patient.txDate}. Sledování po transplantaci.`;
        }
      } else if (note) {
        patient.summary = note;
      }

      demoState.audit.unshift(
        `${now} - ${user.name} zaznamenala u pacienta ${patient.name}: ${option.sameState ? "doplnění podkladů" : `${phaseLabel(oldState)} → ${phaseLabel(targetState)}`}. Podklady: ${docNames.join(", ")}.`
      );
      touchPatientUpdated(patient, now);
      closeCoordinatorFlowStateModal();
      render();
      const activatedPortal = oldState === "POSUZOVANI" && targetState === "WL" && patient.portalActivated;
      if (activatedPortal && wlPortalResult?.ok) {
        if (wlPortalResult.reactivated && !wlPortalResult.alreadyActive) {
          showToast(`Fáze uzavřena. Pacientovi byl reaktivován účet a na ${getPatientPortalEmail(patient)} odešly přístupové údaje.`);
        } else {
          showToast(`Fáze uzavřena. Pacientovi byl aktivován účet a na ${getPatientPortalEmail(patient)} odešly přístupové údaje.`);
        }
      } else {
        showToast(`Fáze ${phaseLabel(oldState)} uzavřena. Výstup odeslán pneumologovi.`);
      }
    }

    function submitInternalChatMessage() {
      const patient = selectedPatient();
      if (!canAddInternalChat(patient)) return;

      const note = document.getElementById("internalChatInput")?.value.trim() || "";
      const taggedUserIds = extractTaggedUserIdsFromMessage(note);
      const user = activeUser();
      const now = formatDemoTimestamp();

      if (!note) {
        showToast("Napište zprávu.");
        return;
      }

      if (!patient.internalChat) patient.internalChat = [];

      patient.internalChat.push({
        id: `${patient.id}-ic-note-${Date.now()}`,
        authorId: user.id,
        author: user.name,
        authorRole: user.roleId,
        createdAt: now,
        body: note,
        taggedUserIds
      });

      const taggedNames = taggedUserIds
        .map((userId) => demoUsers.find((item) => item.id === userId)?.name)
        .filter(Boolean);

      demoState.audit.unshift(
        `${now} - ${user.name} přidal${user.name.includes("ová") ? "a" : ""} interní zprávu u pacienta ${patient.name}${taggedNames.length ? ` (oznámení: ${taggedNames.join(", ")})` : ""}.`
      );
      touchPatientUpdated(patient, now);
      markInternalChatRead(patient);
      render();
      showToast("Interní zpráva byla odeslána.");
    }

    function submitInternalNote() {
      const patient = selectedPatient();
      if (!patient) return;

      const body = document.getElementById("internalNoteInput")?.value.trim() || "";
      if (!body) {
        showToast("Napište poznámku.");
        return;
      }

      const user = activeUser();
      const now = formatDemoTimestamp();

      if (!patient.internalNotes) patient.internalNotes = [];

      patient.internalNotes.push({
        id: `${patient.id}-in-${Date.now()}`,
        author: user.name,
        createdAt: now,
        body: body
      });

      demoState.audit.unshift(`${now} - Přidána interní poznámka k pacientovi ${patient.name} od ${user.name}.`);
      touchPatientUpdated(patient, now);
      render();
      showToast("Poznámka byla uložena.");
    }

    function updateCoordinatorFlowFormDefaults() {
      const patient = coordinatorFlowPatient();
      const select = document.getElementById("coordFlowNextState");
      if (!select) return;

      const option = getCoordinatorFlowOption(patient, select.value);
      const note = document.getElementById("coordFlowNote");
      const txField = document.getElementById("coordFlowTxDateField");
      const summaryEl = document.getElementById("coordFlowClosureSummary");
      const portalEl = document.getElementById("coordFlowPortalActivation");
      const applyBtn = document.getElementById("coordFlowApplyState");
      const isWlActivation = isWaitlistPortalActivationTransition(patient, select.value);

      if (note && option && !note.value.trim()) note.value = option.defaultNote || "";
      if (txField) txField.style.display = option?.needsTxDate ? "block" : "none";
      if (portalEl) {
        portalEl.hidden = !isWlActivation;
        portalEl.innerHTML = isWlActivation ? renderPortalActivationBanner(patient) : "";
      }
      if (applyBtn) {
        const inactivePortal = patientPortalUserIsInactive(patient) || patient.portalPending === true;
        applyBtn.textContent = isWlActivation
          ? (inactivePortal
            ? "Potvrdit uzavření, reaktivovat účet pacienta a odeslat"
            : "Potvrdit uzavření, aktivovat účet pacienta a odeslat")
          : "Potvrdit uzavření a odeslat";
      }
      if (summaryEl && option) {
        summaryEl.innerHTML = renderClosureSummaryPanel(patient, option.bucket || "rozhodnutí");
      }
    }

    const MOBILE_NAV_BREAKPOINT = 900;

    function isMobileNavViewport() {
      return window.matchMedia(`(max-width: ${MOBILE_NAV_BREAKPOINT}px)`).matches;
    }

    function setMobileNavOpen(open) {
      const shouldOpen = Boolean(open) && isMobileNavViewport();
      demoState.mobileNavOpen = shouldOpen;
      const shell = document.getElementById("appShell");
      const toggle = document.getElementById("mobileNavToggle");
      if (shell) shell.classList.toggle("mobile-nav-open", shouldOpen);
      document.body.classList.toggle("mobile-nav-open", shouldOpen);
      if (toggle) {
        toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        toggle.setAttribute("aria-label", shouldOpen ? "Zavřít menu" : "Otevřít menu");
      }
    }

    function syncMobileNavState() {
      if (!isMobileNavViewport()) setMobileNavOpen(false);
    }

    function handleSidebarNavSelection(navId, navType) {
      setMobileNavOpen(false);
      if (navType === "patient") {
        demoState.patientPortalSection = navId;
      } else {
        if (demoState.patientDetailOpen) {
          acknowledgePatientChats();
        }
        demoState.mainTab = navId;
        if (navId === "handbooks") demoState.handbookId = null;
        demoState.patientDetailOpen = false;
        demoState.organOfferId = null;
        demoState.referringSiteId = null;
        demoState.medicationEditingKey = null;
        demoState.examEditingKey = null;
      }
      render();
    }

    function handleMainTabSelection(mainTab) {
      if (demoState.patientDetailOpen) {
        acknowledgePatientChats();
      }
      demoState.mainTab = mainTab;
      demoState.patientDetailOpen = false;
      demoState.organOfferId = null;
      demoState.referringSiteId = null;
      demoState.medicationEditingKey = null;
      demoState.examEditingKey = null;
      render();
    }

    function wireMobileTableLabels(root = document) {
      root.querySelectorAll("table.summary-table").forEach((table) => {
        const headerCells = [...table.querySelectorAll("thead th")];
        if (headerCells.length) {
          const headers = headerCells.map((th) => th.textContent.replace(/\s+/g, " ").trim());
          table.querySelectorAll("tbody tr").forEach((row) => {
            [...row.querySelectorAll(":scope > td")].forEach((td, index) => {
              if (td.hasAttribute("colspan") || td.dataset.label) return;
              if (headers[index]) td.dataset.label = headers[index];
            });
          });
          return;
        }

        table.querySelectorAll("tr").forEach((row) => {
          const th = row.querySelector(":scope > th");
          const td = row.querySelector(":scope > td");
          if (th && td && !td.dataset.label) {
            td.dataset.label = th.textContent.replace(/\s+/g, " ").trim();
          }
        });
      });
    }

    function wireCoreNavigationOnce() {
      if (wireCoreNavigationOnce.done) return;
      wireCoreNavigationOnce.done = true;

      document.getElementById("appShell")?.addEventListener("click", (event) => {
        const navBtn = event.target.closest("[data-sidebar-nav]");
        if (navBtn) {
          event.preventDefault();
          handleSidebarNavSelection(navBtn.dataset.sidebarNav, navBtn.dataset.sidebarNavType);
          return;
        }

        const selectPatientBtn = event.target.closest("[data-select-patient]");
        if (selectPatientBtn) {
          event.preventDefault();
          if (isPatientUser()) return;
          const patientId = selectPatientBtn.dataset.selectPatient;
          if (activeUser().roleId === "ambulatory") {
            const allowed = patientsForAmbulatory().some((item) => item.id === patientId);
            if (!allowed) return;
          }
          if (demoState.patientDetailOpen && demoState.patientId !== patientId) {
            acknowledgePatientChats(demoState.patientId);
          }
          demoState.patientId = patientId;
          demoState.patientDetailOpen = true;
          demoState.pendingScrollToTop = true;
          demoState.dailyRecordsPage = 0;
          acknowledgePatientChats(patientId);
          demoState.patientTab = "overview";
          demoState.ambNewReferral = false;
          demoState.ambEditReferral = false;
          if (selectPatientBtn.hasAttribute("data-amb-go-overview")) {
            demoState.mainTab = "overview";
          }
          render();
          return;
        }

        const toggleBtn = event.target.closest("[data-toggle-sidebar]");
        if (toggleBtn) {
          event.preventDefault();
          demoState.sidebarCollapsed = !demoState.sidebarCollapsed;
          render();
          return;
        }

        const mobileNavToggle = event.target.closest("[data-toggle-mobile-nav]");
        if (mobileNavToggle) {
          event.preventDefault();
          setMobileNavOpen(!demoState.mobileNavOpen);
          return;
        }

        const mobileNavClose = event.target.closest("[data-close-mobile-nav]");
        if (mobileNavClose) {
          event.preventDefault();
          setMobileNavOpen(false);
          return;
        }

        const logoutBtn = event.target.closest("[data-sidebar-logout]");
        if (logoutBtn) {
          event.preventDefault();
          setMobileNavOpen(false);
          showLoginScreen();
          return;
        }
      });

      window.addEventListener("resize", syncMobileNavState, { passive: true });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && demoState.mobileNavOpen) {
          setMobileNavOpen(false);
        }
      });

      document.getElementById("content")?.addEventListener("click", (event) => {
        const mainTabBtn = event.target.closest("[data-main-tab]");
        if (mainTabBtn) {
          event.preventDefault();
          handleMainTabSelection(mainTabBtn.dataset.mainTab);
        }
      });
    }

    function wireUserSettingsOnce() {
      if (wireUserSettingsOnce.done) return;
      wireUserSettingsOnce.done = true;

      document.addEventListener("change", (event) => {
        const control = event.target.closest("[data-user-setting]");
        if (!control) return;
        const user = activeUser();
        const key = control.dataset.userSetting;
        const value = control.type === "checkbox" ? control.checked : control.value;
        setUserPreference(user.id, key, value);
        scheduleStateSync();
        showToast("Nastavení bylo uloženo.");
      });
    }

    function wireInternalChatMentions(textareaId, options = {}) {
      const getMentionUsers = options.getMentionUsers || getInternalStaffUsers;
      const textarea = document.getElementById(textareaId);
      if (!textarea) return;

      let suggestionBox = document.getElementById(`${textareaId}-mentions`);
      if (!suggestionBox) {
        suggestionBox = document.createElement("div");
        suggestionBox.id = `${textareaId}-mentions`;
        suggestionBox.className = "mention-suggestions";
        document.body.appendChild(suggestionBox);
      }

      const staff = getMentionUsers();

      textarea.addEventListener("input", () => {
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        const textBefore = text.slice(0, cursorPos);
        const match = textBefore.match(/@(\w*)$/);

        if (match) {
          const query = match[1].toLowerCase();
          const filtered = staff.filter((user) => {
            const roleName = roleById(user.roleId)?.name || "";
            return user.name.toLowerCase().includes(query)
              || user.roleId.toLowerCase().includes(query)
              || roleName.toLowerCase().includes(query);
          });

          if (filtered.length) {
            const rect = textarea.getBoundingClientRect();
            suggestionBox.style.left = `${rect.left}px`;
            suggestionBox.style.top = `${rect.top - 120}px`; // Above textarea
            suggestionBox.style.width = `${rect.width}px`;
            suggestionBox.innerHTML = filtered.map((u) => `
              <div class="mention-suggestion-item" data-mention-id="${u.id}" data-mention-name="${u.name}">
                <img src="${getUserAvatarUrl(u)}" alt="">
                <div>
                  <strong>${escapeHtml(u.name)}</strong>
                  <span>${escapeHtml(roleById(u.roleId)?.name)}</span>
                </div>
              </div>
            `).join("");
            suggestionBox.classList.add("open");
          } else {
            suggestionBox.classList.remove("open");
          }
        } else {
          suggestionBox.classList.remove("open");
        }
      });

      suggestionBox.addEventListener("click", (e) => {
        const item = e.target.closest(".mention-suggestion-item");
        if (item) {
          const name = item.dataset.mentionName;
          const text = textarea.value;
          const cursorPos = textarea.selectionStart;
          const textBefore = text.slice(0, cursorPos);
          const textAfter = text.slice(cursorPos);
          const newTextBefore = textBefore.replace(/@\w*$/, `@${name} `);
          textarea.value = newTextBefore + textAfter;
          textarea.focus();
          suggestionBox.classList.remove("open");
        }
      });

      document.addEventListener("click", (e) => {
        if (!suggestionBox.contains(e.target) && e.target !== textarea) {
          suggestionBox.classList.remove("open");
        }
      });
    }

    function wireDailyRecordsGlobalEventsOnce() {
      if (wireDailyRecordsGlobalEventsOnce.done) return;

      document.addEventListener("click", (event) => {
        const trendsBtn = event.target.closest("[data-open-trends]");
        if (trendsBtn) {
          event.preventDefault();
          openPatientTrends(trendsBtn.dataset.openTrends);
          return;
        }

        const aiBtn = event.target.closest("[data-open-daily-ai]");
        if (aiBtn) {
          event.preventDefault();
          openDailyRecordsAiModal(aiBtn.dataset.openDailyAi);
          return;
        }

        const closeAiBtn = event.target.closest("[data-close-daily-ai]");
        if (closeAiBtn) {
          event.preventDefault();
          closeDailyRecordsAiModal();
          return;
        }

        const closeTrendsBtn = event.target.closest("[data-close-trends]");
        if (closeTrendsBtn) {
          event.preventDefault();
          closePatientTrends();
          return;
        }
      });

      wireDailyRecordsGlobalEventsOnce.done = true;
    }

    function attachEvents() {
      wirePatientEditModalOnce();
      wireDailyRecordsGlobalEventsOnce();
      wireCoreNavigationOnce();
      wireUserSettingsOnce();
      wireOrganOffersOnce();

      document.querySelectorAll("[data-edit-patient-demographics]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openPatientEditModal(button.dataset.editPatientDemographics);
        });
      });

      document.querySelectorAll("[data-close-patient-edit]").forEach((button) => {
        button.addEventListener("click", closePatientEditModal);
      });

      document.querySelectorAll("[data-save-patient-edit]").forEach((button) => {
        button.addEventListener("click", savePatientEditDemographics);
      });

      document.querySelectorAll("[data-patient-detail-back]").forEach((button) => {
        button.addEventListener("click", () => {
          acknowledgePatientChats();
          demoState.patientDetailOpen = false;
          demoState.ambEditReferral = false;
          render();
        });
      });

      attachMedicationRowEvents();

      document.querySelectorAll("[data-referring-site]").forEach((element) => {
        const open = () => {
          demoState.referringSiteId = element.dataset.referringSite;
          render();
        };
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          open();
        });
        element.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          open();
        });
      });

      document.querySelectorAll("[data-patient-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.patientTab = button.dataset.patientTab;
          render();
        });
      });

      document.querySelectorAll("[data-patient-state-filter]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.patientStateFilter = button.dataset.patientStateFilter;
          render();
        });
      });

      document.querySelectorAll("[data-patient-sort]").forEach((button) => {
        button.addEventListener("click", () => {
          const sortKey = button.dataset.patientSort;
          if (demoState.patientListSort === sortKey) {
            demoState.patientListSortDir = demoState.patientListSortDir === "desc" ? "asc" : "desc";
          } else {
            demoState.patientListSort = sortKey;
            demoState.patientListSortDir = "desc";
          }
          render();
        });
      });

      document.querySelectorAll("[data-patient-list-search]").forEach((input) => {
        input.addEventListener("input", () => {
          demoState.patientListSearch = input.value;
          demoState.patientListSearchCaret = input.selectionStart;
          render();
        });
      });

      const listSearchInput = document.querySelector("[data-patient-list-search]");
      if (listSearchInput && typeof demoState.patientListSearchCaret === "number") {
        listSearchInput.focus();
        listSearchInput.setSelectionRange(demoState.patientListSearchCaret, demoState.patientListSearchCaret);
        demoState.patientListSearchCaret = null;
      }

      document.querySelectorAll("[data-send-referral-chat]").forEach((button) => {
        button.addEventListener("click", () => sendReferralChatMessage(button.dataset.sendReferralChat));
      });

      document.querySelectorAll("[data-toggle-referral-chat]").forEach((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          demoState.referralChatOpen = !demoState.referralChatOpen;
          render();
        });
      });

      document.querySelectorAll("[data-toggle-organ-offer-chat]").forEach((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const offerId = element.dataset.toggleOrganOfferChat;
          if (offerId) {
            demoState.organOfferId = offerId;
          }
          demoState.organOfferChatOpen = !demoState.organOfferChatOpen;
          render();
        });
      });

      document.querySelectorAll("[data-send-organ-offer-chat]").forEach((button) => {
        button.addEventListener("click", () => sendOrganOfferChatMessage(button.dataset.sendOrganOfferChat));
      });

      const organOfferChatInput = document.getElementById("organOfferChatInput");
      if (organOfferChatInput) {
        organOfferChatInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          const offerId = selectedOrganOffer()?.id;
          if (offerId) sendOrganOfferChatMessage(offerId);
        });
        wireInternalChatMentions("organOfferChatInput");
      }

      wireInternalChatMentions("internalChatInput");
      wireInternalChatMentions("referralChatInput", { getMentionUsers: getAmbulatoryMentionUsers });

      document.querySelectorAll("[data-open-coordinator-flow-state]").forEach((element) => {
        const open = () => openCoordinatorFlowStateModal(element.dataset.openCoordinatorFlowState);
        element.addEventListener("click", open);
        element.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          open();
        });
      });

      document.querySelectorAll("[data-close-coordinator-flow-state]").forEach((button) => {
        button.addEventListener("click", closeCoordinatorFlowStateModal);
      });

      document.querySelectorAll("[data-open-phase-evidence]").forEach((button) => {
        button.addEventListener("click", () => {
          openPhaseEvidenceModal(button.dataset.openPhaseEvidence, button.dataset.phaseBucket);
        });
      });

      document.querySelectorAll("[data-close-phase-evidence]").forEach((button) => {
        button.addEventListener("click", closePhaseEvidenceModal);
      });

      document.querySelectorAll("[data-contrib-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
          const submissionId = button.dataset.contribToggle;
          if (!submissionId) return;
          if (!demoState.expandedContributions) demoState.expandedContributions = {};
          const nextOpen = !isContributionExpanded(submissionId);
          demoState.expandedContributions[submissionId] = nextOpen;
          if (nextOpen) {
            demoState.expandedContributions[`${submissionId}:files`] = true;
          }
          render();
        });
      });

      document.querySelectorAll("[data-daily-record-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
          const recordKey = button.dataset.dailyRecordToggle;
          if (!recordKey) return;
          if (!demoState.expandedDailyRecords) demoState.expandedDailyRecords = {};
          demoState.expandedDailyRecords[recordKey] = !isDailyRecordExpanded(recordKey);
          render();
        });
      });

      document.querySelectorAll("[data-contrib-files-toggle]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const submissionId = button.dataset.contribFilesToggle;
          if (!submissionId) return;
          if (!demoState.expandedContributions) demoState.expandedContributions = {};
          const key = `${submissionId}:files`;
          demoState.expandedContributions[key] = !isContributionFilesExpanded(submissionId);
          render();
        });
      });

      document.querySelectorAll("[data-contrib-download-bundle]").forEach((button) => {
        button.addEventListener("click", () => {
          const patient = selectedPatient();
          const ids = String(button.dataset.contribDownloadBundle || "").split(",").filter(Boolean);
          const files = ids.flatMap((id) => findPatientFlowSubmission(patient, id)?.files || []);
          downloadClinicalFileList(files);
        });
      });

      document.querySelectorAll("[data-contrib-download-all]").forEach((button) => {
        button.addEventListener("click", () => {
          const patient = selectedPatient();
          const submission = findPatientFlowSubmission(patient, button.dataset.contribDownloadAll);
          downloadClinicalFileList(submission?.files || []);
        });
      });

      wireExamPlanSectionEvents();

      document.querySelectorAll("[data-close-coordinator-exams]").forEach((button) => {
        button.addEventListener("click", closeExamModal);
      });

      const internalChatApply = document.getElementById("internalChatApply");
      if (internalChatApply) {
        internalChatApply.addEventListener("click", submitInternalChatMessage);
      }
      const internalChatInput = document.getElementById("internalChatInput");
      if (internalChatInput) {
        internalChatInput.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          submitInternalChatMessage();
        });
      }

      const addInternalNoteBtn = document.getElementById("addInternalNoteBtn");
      if (addInternalNoteBtn) {
        addInternalNoteBtn.addEventListener("click", submitInternalNote);
      }

      const internalNoteInput = document.getElementById("internalNoteInput");
      if (internalNoteInput) {
        internalNoteInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitInternalNote();
          }
        });
      }

      const coordFlowNextState = document.getElementById("coordFlowNextState");
      if (coordFlowNextState) {
        coordFlowNextState.addEventListener("change", updateCoordinatorFlowFormDefaults);
      }

      const coordFlowApplyState = document.getElementById("coordFlowApplyState");
      if (coordFlowApplyState) {
        coordFlowApplyState.addEventListener("click", applyCoordinatorFlowState);
      }

      document.querySelectorAll("[data-amb-new-referral]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.ambNewReferral = true;
          render();
        });
      });

      document.querySelectorAll("[data-doc-download]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          downloadClinicalDocument(button.dataset.docDownload);
        });
      });

      document.querySelectorAll("[data-amb-cancel-new]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.ambNewReferral = false;
          demoState.mainTab = "overview";
          render();
        });
      });

      document.querySelectorAll("[data-amb-edit-referral]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.patientId = button.dataset.ambEditReferral;
          demoState.ambEditReferral = true;
          demoState.ambNewReferral = false;
          demoState.mainTab = "overview";
          render();
        });
      });

      document.querySelectorAll("[data-amb-cancel-referral-form]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.ambNewReferral = false;
          demoState.ambEditReferral = false;
          demoState.mainTab = "overview";
          render();
        });
      });

      wireAmbPatientForm();

      document.querySelectorAll("[data-submit-daily-record]").forEach((button) => {
        button.addEventListener("click", () => {
          submitPatientDailyRecord(button.dataset.submitDailyRecord);
        });
      });

      document.querySelectorAll("[data-daily-records-page]").forEach((button) => {
        button.addEventListener("click", () => {
          const page = Number(button.dataset.page);
          if (!Number.isFinite(page) || page < 0 || button.disabled) return;
          demoState.dailyRecordsPage = page;
          render();
        });
      });

      document.querySelectorAll("[data-alert-status]").forEach((button) => {        button.addEventListener("click", () => {
          const alert = demoState.alerts.find((item) => item.id === button.dataset.alertStatus);
          if (alert) {
            alert.status = button.dataset.nextStatus;
            demoState.audit.unshift(`${new Date().toLocaleString("cs-CZ")} - Podnět "${alert.type}" pro pacienta ${patientName(alert.patientId)} zmenen na stav ${alert.status}.`);
            render();
            showToast("Stav podnětu byl aktualizován. Reakci stále potvrzuje člověk z týmu.");
          }
        });
      });

      document.querySelectorAll("[data-open-override]").forEach((button) => {
        button.addEventListener("click", () => {
          document.getElementById("overrideModal").classList.add("open");
        });
      });

      document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", closeModal);
      });

      document.querySelectorAll("[data-demo-action]").forEach((button) => {
        button.addEventListener("click", () => {
          if (button.dataset.demoAction === "referral-save") {
            saveAmbulatoryReferral();
            return;
          }
          showToast("Toto je demo akce bez napojení na backend.");
        });
      });

      wireUserSettingsOnce();
      if (!attachEvents.adminReady) {
        attachEvents.adminReady = true;
        window.LtxAdmin?.attachAdminEvents?.();
      }

      document.querySelectorAll("[data-open-handbook]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.mainTab = "handbooks";
          demoState.handbookId = button.dataset.openHandbook;
          render();
        });
      });

      document.querySelectorAll("[data-handbooks-back]").forEach((button) => {
        button.addEventListener("click", () => {
          demoState.handbookId = null;
          render();
        });
      });
    }

    function closeModal() {
      document.getElementById("overrideModal").classList.remove("open");
    }

    document.getElementById("confirmOverride").addEventListener("click", () => {
      const reason = escapeHtml(document.getElementById("overrideReason").value.trim() || "Override bez detailu.");
      demoState.audit.unshift(`${new Date().toLocaleString("cs-CZ")} - Koordinátor provedl override mekke brany. Důvod: ${reason}`);
      closeModal();
      render();
      showToast("Override byl zapsán do auditu.");
    });

    document.getElementById("ambReferralSentModal").addEventListener("click", (event) => {
      if (event.target.id === "ambReferralSentModal") closeAmbReferralSentModal();
    });

    document.querySelectorAll("[data-close-amb-referral-sent]").forEach((button) => {
      button.addEventListener("click", closeAmbReferralSentModal);
    });

    document.getElementById("examCompleteDoneModal").addEventListener("click", (event) => {
      if (event.target.id === "examCompleteDoneModal") closeExamCompleteDoneModal();
    });

    document.getElementById("dailyRecordsAiModal")?.addEventListener("click", (event) => {
      if (event.target.id === "dailyRecordsAiModal" || event.target.closest("[data-close-daily-ai]")) {
        closeDailyRecordsAiModal();
      }
    });

    document.getElementById("viewUserPhoto")?.addEventListener("dblclick", (event) => {
      openDemoRoleModal(event.clientX, event.clientY);
      renderShell();
      requestAnimationFrame(() => positionDemoRoleModal());
    });

    document.getElementById("userMenuList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-switch-user]");
      if (button) switchDemoUser(button.dataset.switchUser);
    });

    document.querySelectorAll("[data-close-demo-role]").forEach((button) => {
      button.addEventListener("click", closeDemoRoleModal);
    });

    document.getElementById("demoRoleModal")?.addEventListener("click", (event) => {
      if (event.target.id === "demoRoleModal") closeDemoRoleModal();
    });

    document.getElementById("openPersonalNotesBtn")?.addEventListener("click", openPersonalNotesModal);
    document.getElementById("savePersonalNotes")?.addEventListener("click", savePersonalNotes);
    document.querySelectorAll("[data-close-personal-notes]").forEach((button) => {
      button.addEventListener("click", closePersonalNotesModal);
    });
    document.getElementById("personalNotesModal")?.addEventListener("click", (event) => {
      if (event.target.id === "personalNotesModal") closePersonalNotesModal();
    });

    document.querySelectorAll("[data-close-exam-complete-done]").forEach((button) => {
      button.addEventListener("click", closeExamCompleteDoneModal);
    });

    document.getElementById("coordinatorExamModal").addEventListener("click", (event) => {
      if (event.target.id === "coordinatorExamModal") closeExamModal();
    });

    initAttachPickerSystemOnce();
    wireCoreNavigationOnce();
    wireUserSettingsOnce();
    wireCoordinatorExamModalOnce();
    wirePhaseEvidenceSidebarOnce();

    document.getElementById("coordinatorFlowStateModal").addEventListener("click", (event) => {
      if (event.target.id === "coordinatorFlowStateModal") closeCoordinatorFlowStateModal();
    });

    document.getElementById("overrideModal").addEventListener("click", (event) => {
      if (event.target.id === "overrideModal") closeModal();
    });

    function render() {
      const user = activeUser();
      if (user.roleId !== "patient" && !isAdminModeActive()) {
        ensureStaffMainTab(user);
      }
      renderAppSidebar();
      renderShell();
      renderMetrics();
      try {
        renderContent();
      } catch (error) {
        console.error("Chyba vykreslení obsahu:", error);
        showToast("Nepodařilo se načíst obrazovku. Zkuste obnovit stránku.");
      }

      const sidebarContainer = document.getElementById("referralChatSidebarContainer");
      if (sidebarContainer) {
        sidebarContainer.innerHTML = renderReferralChatSidebar();
      }

      const organChatContainer = document.getElementById("organOfferChatSidebarContainer");
      if (organChatContainer) {
        organChatContainer.innerHTML = renderOrganOfferChatSidebar();
      }

      const organOfferModal = document.getElementById("organOfferModal");

      if (organOfferModal) {
        organOfferModal.classList.toggle("open", Boolean(demoState.organOfferFormOpen));
        if (demoState.organOfferFormOpen) {
          document.getElementById("organOfferModalBody").innerHTML = renderOrganOfferModal();
        }
      }

      // Scroll lock pro pozadí
      syncPageScrollLock();
      setMobileNavOpen(Boolean(demoState.mobileNavOpen));

      attachEvents();
      wireMobileTableLabels();
      initReferringGoogleMapAfterRender();
      scrollReferralChatToBottom();
      scrollOrganOfferChatToBottom();
      scrollInternalChatToBottom();

      if (demoState.pendingScrollToTop) {
        demoState.pendingScrollToTop = false;
        requestAnimationFrame(() => {
          scrollAppContentToTop();
          requestAnimationFrame(scrollAppContentToTop);
        });
      }

      scheduleStateSync();
    }

    wireLoginOnce();

    window.LtxApp = {
      activeUser,
      activeRoleId,
      isAdminModeActive,
      hasAdminPermission,
      roleById,
      getDemoState: () => demoState,
      getPatients: () => patients,
      render,
      showToast,
      syncPageScrollLock,
      wireMobileTableLabels,
      applyCodeLists,
      renderMonoIcon
    };
