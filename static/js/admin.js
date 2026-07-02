(function () {
  "use strict";

  let systemUsers = [];
  let codeLists = { phases: [], patientDailySymptoms: [], alertLevels: [] };
  let sharedMaterials = { psych: [], rehab: [] };
  let systemFaqs = [];
  let adminAudit = [];
  let roleOptions = [];
  let onStateChange = null;

  function escapeAdminHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function wrapAdminDrawerShell({ titleId, title, cancelAction, bodyHtml, footerHtml }) {
    return `
      <div class="patient-edit-header">
        <h3 id="${titleId}">${title}</h3>
        <button type="button" class="patient-edit-close" data-${cancelAction} aria-label="Zavřít">×</button>
      </div>
      <div class="patient-edit-body">
        ${bodyHtml}
      </div>
      <div class="patient-edit-footer">
        ${footerHtml}
      </div>
    `;
  }

  function renderAdminMonoIcon(id) {
    return window.LtxApp?.renderMonoIcon?.(id, "mono-icon med-action-icon") || "";
  }

  function renderAdminIconButton({ icon, label, extraClass = "", dataAttr, dataValue = "" }) {
    const dataName = dataAttr ? `data-${dataAttr}` : "";
    return `
      <button
        type="button"
        class="med-icon-btn ${extraClass}"
        ${dataName}${dataValue ? `="${escapeAdminHtml(dataValue)}"` : ""}
        aria-label="${escapeAdminHtml(label)}"
        title="${escapeAdminHtml(label)}"
      >${renderAdminMonoIcon(icon)}</button>
    `;
  }

  function formatAdminTimestamp() {
    return new Date().toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(",", "");
  }

  function getUsers(includeInactive = true) {
    return includeInactive ? [...systemUsers] : systemUsers.filter((user) => user.active !== false);
  }

  function getUserById(userId) {
    return systemUsers.find((user) => user.id === userId) || null;
  }

  function isPatientPortalUser(user) {
    return user?.roleId === "patient";
  }

  function getStaffUsers(includeInactive = true) {
    return getUsers(includeInactive).filter((user) => !isPatientPortalUser(user));
  }

  function getPatientPortalUsers(includeInactive = true) {
    return getUsers(includeInactive).filter(isPatientPortalUser);
  }

  function getStaffRoleOptions() {
    return roleOptions.filter((role) => role.id !== "patient");
  }

  function getPatients() {
    return window.LtxApp?.getPatients?.() || [];
  }

  function getPatientById(patientId) {
    return getPatients().find((patient) => patient.id === patientId) || null;
  }

  function formatPatientRecordLabel(patientId) {
    const patient = getPatientById(patientId);
    if (!patient) return patientId;
    return `${patient.name} (${patientId})`;
  }

  function resolvePatientWorkplace(patientId) {
    const patient = getPatientById(patientId);
    if (!patient) return "Pacient";
    if (patient.state === "WL") return "Pacient na čekací listině";
    if (patient.state === "PO_TX") return "Pacient po transplantaci";
    if (patient.state === "UKONCENO") return "Pacient (ukončeno)";
    return "Pacient v posuzování";
  }

  function getPatientsAvailableForPortal(excludeUserId = null) {
    return getPatients().filter((patient) => {
      const linked = getPatientPortalUser(patient);
      if (!linked) return true;
      return excludeUserId && linked.id === excludeUserId;
    });
  }

  function syncPatientPortalFlags(patient, user) {
    if (!patient || !user) return;
    patient.portalEmail = user.email;
    patient.portalActivated = user.active === true;
    patient.portalPending = user.active !== true;
    if (patient.demographics) patient.demographics.email = user.email;
    if (user.phone && patient.demographics) patient.demographics.phone = user.phone;
    if (user.active && !patient.portalActivatedAt) {
      patient.portalActivatedAt = formatAdminTimestamp();
    }
  }

  function hasAdminPermission(user) {
    if (!user) return false;
    return Array.isArray(user.permissions) && user.permissions.includes("ADMIN");
  }

  function recordAdminAudit(action, entityType, entityId, detail) {
    const actor = window.LtxApp?.activeUser?.() || null;
    const entry = {
      id: `aa-${Date.now()}`,
      at: formatAdminTimestamp(),
      actorId: actor?.id || "",
      actorName: actor?.name || "Neznámý",
      actingRole: window.LtxApp?.isAdminModeActive?.() ? "admin" : (actor?.roleId || ""),
      action,
      entityType,
      entityId: entityId || "",
      detail: detail || ""
    };
    adminAudit.unshift(entry);
    if (onStateChange) onStateChange();
    return entry;
  }

  function enterAdminMode() {
    const app = window.LtxApp;
    if (!app || !hasAdminPermission(app.activeUser()) || app.isAdminModeActive()) return false;
    const user = app.activeUser();
    app.getDemoState().adminReturnContext = {
      role: user.roleId,
      mainTab: app.getDemoState().mainTab,
      handbookId: app.getDemoState().handbookId,
      patientDetailOpen: app.getDemoState().patientDetailOpen
    };
    app.getDemoState().adminModeActive = true;
    app.getDemoState().role = "admin";
    app.getDemoState().mainTab = "admin-users";
    app.getDemoState().handbookId = null;
    app.getDemoState().patientDetailOpen = false;
    recordAdminAudit("enter_admin_mode", "system", null, "Přepnutí do režimu administrátora");
    return true;
  }

  function exitAdminMode() {
    const app = window.LtxApp;
    const ctx = app?.getDemoState()?.adminReturnContext;
    if (!app || !app.isAdminModeActive() || !ctx) return false;
    closeAdminUserModal();
    closeAdminMaterialModal();
    closeAdminHandbookModal();
    recordAdminAudit("exit_admin_mode", "system", null, "Návrat z režimu administrátora");
    app.getDemoState().adminModeActive = false;
    app.getDemoState().role = ctx.role;
    app.getDemoState().mainTab = ctx.mainTab;
    app.getDemoState().handbookId = ctx.handbookId;
    app.getDemoState().patientDetailOpen = ctx.patientDetailOpen;
    app.getDemoState().adminReturnContext = null;
    return true;
  }

  function finishUserModalSave(message) {
    const appState = window.LtxApp?.getDemoState();
    if (appState) {
      appState.adminEditingUserId = null;
      appState.adminEditingUserFormKind = null;
    }
    closeAdminUserModal();
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.(message);
  }

  function saveSystemUserFromForm(userId) {
    const form = document.getElementById("adminUserForm");
    if (!form) return;
    const isNew = userId === "new";
    const existing = isNew ? null : getUserById(userId);
    if (existing && isPatientPortalUser(existing)) {
      window.LtxApp?.showToast?.("Portálový účet pacienta upravte v sekci pacientů.");
      return;
    }

    const id = isNew ? `u-${Date.now()}` : userId;
    const roleId = form.querySelector('[data-field="roleId"]')?.value || "coordinator";
    const payload = {
      id,
      name: form.querySelector('[data-field="name"]')?.value.trim() || "",
      roleId,
      workplace: form.querySelector('[data-field="workplace"]')?.value.trim() || "",
      email: form.querySelector('[data-field="email"]')?.value.trim() || "",
      phone: form.querySelector('[data-field="phone"]')?.value.trim() || "",
      active: form.querySelector('[data-field="active"]')?.checked !== false,
      permissions: form.querySelector('[data-field="perm-admin"]')?.checked ? ["ADMIN"] : []
    };

    if (existing?.defaultPatientId) payload.defaultPatientId = existing.defaultPatientId;

    if (!payload.name) {
      window.LtxApp?.showToast?.("Vyplňte jméno uživatele.");
      return;
    }

    if (isNew) {
      systemUsers.push(payload);
      recordAdminAudit("user_create", "user", id, `Vytvořen uživatel ${payload.name} (${payload.roleId})`);
    } else {
      const index = systemUsers.findIndex((user) => user.id === userId);
      if (index < 0) return;
      const updated = { ...systemUsers[index], ...payload, id: userId };
      delete updated.patientId;
      systemUsers[index] = updated;
      recordAdminAudit("user_update", "user", userId, `Upraven uživatel ${payload.name}`);
    }
    finishUserModalSave("Uživatel systému byl uložen.");
  }

  function savePatientPortalFromForm(userId) {
    const form = document.getElementById("adminUserForm");
    if (!form) return;
    const isNew = userId === "new";
    const existing = isNew ? null : getUserById(userId);
    if (existing && !isPatientPortalUser(existing)) {
      window.LtxApp?.showToast?.("Účet zaměstnance upravte v sekci uživatelů systému.");
      return;
    }

    const patientId = isNew
      ? form.querySelector('[data-field="patientId"]')?.value || ""
      : existing?.patientId || "";
    const patient = getPatientById(patientId);
    if (!patient) {
      window.LtxApp?.showToast?.("Vyberte pacienta pro portálový účet.");
      return;
    }

    const linkedUser = getPatientPortalUser(patient);
    if (isNew && linkedUser) {
      window.LtxApp?.showToast?.("Tento pacient už má portálový účet.");
      return;
    }

    const email = form.querySelector('[data-field="email"]')?.value.trim().toLowerCase() || "";
    if (!email) {
      window.LtxApp?.showToast?.("Vyplňte e-mail pro portálový účet.");
      return;
    }

    const displayName = form.querySelector('[data-field="name"]')?.value.trim()
      || patient.name
      || `${patient.demographics?.firstName || ""} ${patient.demographics?.lastName || ""}`.trim();
    const phone = form.querySelector('[data-field="phone"]')?.value.trim() || patient.demographics?.phone || "";
    const active = form.querySelector('[data-field="active"]')?.checked !== false;
    const id = isNew ? `u-patient-${patientId}` : userId;

    const payload = {
      id,
      name: displayName,
      roleId: "patient",
      workplace: resolvePatientWorkplace(patientId),
      email,
      phone,
      patientId,
      active,
      permissions: []
    };

    if (isNew) {
      systemUsers.push(payload);
      recordAdminAudit("user_create", "user", id, `Vytvořen portálový účet ${payload.name} (${patientId})`);
    } else {
      const index = systemUsers.findIndex((user) => user.id === userId);
      if (index < 0) return;
      systemUsers[index] = { ...systemUsers[index], ...payload, id: userId, patientId: existing.patientId };
      recordAdminAudit("user_update", "user", userId, `Upraven portálový účet ${payload.name}`);
    }

    syncPatientPortalFlags(patient, payload);
    finishUserModalSave("Portálový účet pacienta byl uložen.");
  }

  function saveUserFromForm(userId, formKind) {
    if (formKind === "patient") savePatientPortalFromForm(userId);
    else saveSystemUserFromForm(userId);
  }

  function openAdminUserModal(userId, formKind) {
    wireAdminUserModalOnce();

    const modal = document.getElementById("adminUserModal");
    const body = document.getElementById("adminUserModalBody");
    if (!modal || !body) return;

    const existing = userId === "new" ? null : getUserById(userId);
    const resolvedKind = formKind || (existing && isPatientPortalUser(existing) ? "patient" : "system");

    const appState = window.LtxApp?.getDemoState();
    if (appState) {
      appState.adminEditingUserId = userId;
      appState.adminEditingUserFormKind = resolvedKind;
    }

    body.innerHTML = resolvedKind === "patient"
      ? renderPatientPortalForm(userId)
      : renderSystemUserForm(userId);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    window.LtxApp?.syncPageScrollLock?.();
    body.querySelector('[data-field="name"], [data-field="patientId"]')?.focus();
  }

  function closeAdminUserModal() {
    const modal = document.getElementById("adminUserModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    window.LtxApp?.syncPageScrollLock?.();

    const appState = window.LtxApp?.getDemoState();
    if (appState) {
      appState.adminEditingUserId = null;
      appState.adminEditingUserFormKind = null;
    }
  }

  function wireAdminUserModalOnce() {
    if (wireAdminUserModalOnce.done) return;
    wireAdminUserModalOnce.done = true;

    const modal = document.getElementById("adminUserModal");
    modal?.addEventListener("click", (event) => {
      if (event.target.id === "adminUserModal") {
        closeAdminUserModal();
        return;
      }

      const cancelBtn = event.target.closest("[data-admin-cancel-user]");
      if (cancelBtn) {
        event.preventDefault();
        closeAdminUserModal();
        return;
      }

      const saveBtn = event.target.closest("[data-admin-save-user]");
      if (saveBtn) {
        event.preventDefault();
        saveUserFromForm(saveBtn.dataset.adminSaveUser, saveBtn.dataset.adminUserFormKind);
      }
    });

    modal?.addEventListener("change", (event) => {
      const patientSelect = event.target.closest('[data-field="patientId"]');
      if (!patientSelect || patientSelect.tagName !== "SELECT") return;
      const patient = getPatientById(patientSelect.value);
      if (!patient) return;
      const userForm = document.getElementById("adminUserForm");
      const nameInput = userForm?.querySelector('[data-field="name"]');
      const emailInput = userForm?.querySelector('[data-field="email"]');
      const phoneInput = userForm?.querySelector('[data-field="phone"]');
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = patient.name
          || `${patient.demographics?.firstName || ""} ${patient.demographics?.lastName || ""}`.trim();
      }
      if (emailInput && !emailInput.value.trim()) {
        emailInput.value = patient.demographics?.email || patient.portalEmail || "";
      }
      if (phoneInput && !phoneInput.value.trim()) {
        phoneInput.value = patient.demographics?.phone || "";
      }
    });
  }

  function openAdminMaterialModal(category, materialId) {
    wireAdminMaterialModalOnce();

    const modal = document.getElementById("adminMaterialModal");
    const body = document.getElementById("adminMaterialModalBody");
    if (!modal || !body) return;

    const appState = window.LtxApp?.getDemoState();
    if (appState) {
      appState.adminEditingMaterialId = materialId;
      appState.adminEditingMaterialCategory = category;
    }

    body.innerHTML = renderMaterialForm(category, materialId);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    window.LtxApp?.syncPageScrollLock?.();
    body.querySelector('[data-field="title"]')?.focus();
  }

  function closeAdminMaterialModal() {
    const modal = document.getElementById("adminMaterialModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    window.LtxApp?.syncPageScrollLock?.();

    const appState = window.LtxApp?.getDemoState();
    if (appState) {
      appState.adminEditingMaterialId = null;
      appState.adminEditingMaterialCategory = null;
    }
  }

  function wireAdminMaterialModalOnce() {
    if (wireAdminMaterialModalOnce.done) return;
    wireAdminMaterialModalOnce.done = true;

    const modal = document.getElementById("adminMaterialModal");
    modal?.addEventListener("click", (event) => {
      if (event.target.id === "adminMaterialModal") {
        closeAdminMaterialModal();
        return;
      }

      if (event.target.closest("[data-admin-cancel-material]")) {
        event.preventDefault();
        closeAdminMaterialModal();
        return;
      }

      const saveBtn = event.target.closest("[data-admin-save-material]");
      if (saveBtn) {
        event.preventDefault();
        saveMaterialFromForm(saveBtn.dataset.adminSaveMaterial, saveBtn.dataset.adminMaterialCategory);
        return;
      }

      const saveFaqBtn = event.target.closest("[data-admin-save-faq]");
      if (saveFaqBtn) {
        event.preventDefault();
        saveFaqFromForm();
        return;
      }
    });
  }

  function openAdminHandbookModal(handbookId) {
    wireAdminHandbookModalOnce();

    const modal = document.getElementById("adminHandbookModal");
    const body = document.getElementById("adminHandbookModalBody");
    if (!modal || !body) return;

    const appState = window.LtxApp?.getDemoState();
    if (appState) appState.adminEditingHandbookId = handbookId;

    body.innerHTML = renderHandbookForm(handbookId);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    window.LtxApp?.syncPageScrollLock?.();
    body.querySelector('[data-field="title"]')?.focus();
  }

  function closeAdminHandbookModal() {
    const modal = document.getElementById("adminHandbookModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    window.LtxApp?.syncPageScrollLock?.();

    const appState = window.LtxApp?.getDemoState();
    if (appState) appState.adminEditingHandbookId = null;
  }

  function wireAdminHandbookModalOnce() {
    if (wireAdminHandbookModalOnce.done) return;
    wireAdminHandbookModalOnce.done = true;

    const modal = document.getElementById("adminHandbookModal");
    modal?.addEventListener("click", (event) => {
      if (event.target.id === "adminHandbookModal") {
        closeAdminHandbookModal();
        return;
      }

      if (event.target.closest("[data-admin-cancel-handbook]")) {
        event.preventDefault();
        closeAdminHandbookModal();
        return;
      }

      const saveBtn = event.target.closest("[data-admin-save-handbook]");
      if (saveBtn) {
        event.preventDefault();
        saveHandbookFromForm(saveBtn.dataset.adminSaveHandbook);
      }
    });
  }

  function deactivateUser(userId) {
    const user = getUserById(userId);
    if (!user) return;
    user.active = false;
    if (isPatientPortalUser(user) && user.patientId) {
      syncPatientPortalFlags(getPatientById(user.patientId), user);
    }
    recordAdminAudit("user_deactivate", "user", userId, `Deaktivován uživatel ${user.name}`);
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Uživatel byl deaktivován.");
  }

  function activateUser(userId) {
    const user = getUserById(userId);
    if (!user) return;
    user.active = true;
    if (isPatientPortalUser(user) && user.patientId) {
      syncPatientPortalFlags(getPatientById(user.patientId), user);
    }
    recordAdminAudit("user_activate", "user", userId, `Aktivován uživatel ${user.name}`);
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Uživatel byl aktivován.");
  }

  function deleteUser(userId) {
    const user = getUserById(userId);
    if (!user) return;
    if (user.id === window.LtxApp?.getDemoState()?.userId) {
      window.LtxApp?.showToast?.("Nelze smazat právě přihlášeného uživatele.");
      return;
    }
    if (isPatientPortalUser(user) && user.patientId) {
      const patient = getPatientById(user.patientId);
      if (patient) {
        patient.portalEmail = "";
        patient.portalActivated = false;
        patient.portalPending = false;
        delete patient.portalActivatedAt;
      }
    }
    systemUsers = systemUsers.filter((item) => item.id !== userId);
    recordAdminAudit("user_delete", "user", userId, `Smazán uživatel ${user.name}`);
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Uživatel byl odstraněn.");
  }

  function saveCodeListsFromForm() {
    const phasesRaw = document.getElementById("adminCodePhases")?.value || "";
    const symptomsRaw = document.getElementById("adminCodeSymptoms")?.value || "";
    const alertsRaw = document.getElementById("adminCodeAlerts")?.value || "";
    codeLists.phases = phasesRaw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [code, label] = line.split("|").map((part) => part.trim());
      return { code, label: label || code };
    });
    codeLists.patientDailySymptoms = symptomsRaw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [id, label] = line.split("|").map((part) => part.trim());
      return { id, label: label || id };
    });
    codeLists.alertLevels = alertsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
    window.LtxApp?.applyCodeLists?.(codeLists);
    recordAdminAudit("codelists_update", "codelists", null, "Aktualizace číselníků fází, symptomů a úrovní podnětů");
    if (onStateChange) onStateChange();
    window.LtxApp?.showToast?.("Číselníky byly uloženy.");
  }

  function saveMaterialFromForm(materialId, category) {
    const form = document.getElementById("adminMaterialForm");
    if (!form) return;
    const isNew = materialId === "new";
    const id = isNew ? `${category}-${Date.now()}` : materialId;
    const item = {
      id,
      title: form.querySelector('[data-field="title"]')?.value.trim() || "",
      category: form.querySelector('[data-field="category"]')?.value.trim() || (category === "psych" ? "Psychika & podpora" : "Rehabilitace"),
      duration: form.querySelector('[data-field="duration"]')?.value.trim() || "",
      author: form.querySelector('[data-field="author"]')?.value.trim() || "",
      description: form.querySelector('[data-field="description"]')?.value.trim() || "",
      audience: form.querySelector('[data-field="audience"]')?.value.trim() || "WL",
      active: form.querySelector('[data-field="active"]')?.checked !== false,
      attachments: readMaterialAttachmentsFromForm(form)
    };
    if (!item.title) {
      window.LtxApp?.showToast?.("Vyplňte název materiálu.");
      return;
    }
    const list = sharedMaterials[category] || (sharedMaterials[category] = []);
    if (isNew) {
      list.push(item);
      recordAdminAudit("material_create", "material", id, `${category}: ${item.title}`);
    } else {
      const index = list.findIndex((entry) => entry.id === materialId);
      if (index >= 0) list[index] = { ...list[index], ...item, id: materialId };
      recordAdminAudit("material_update", "material", materialId, `${category}: ${item.title}`);
    }
    closeAdminMaterialModal();
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Materiál byl uložen.");
  }

  function activateMaterial(materialId, category) {
    const list = sharedMaterials[category] || [];
    const item = list.find((entry) => entry.id === materialId);
    if (!item) return;
    item.active = true;
    recordAdminAudit("material_activate", "material", materialId, `${category}: ${item.title}`);
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Materiál je znovu viditelný.");
  }

  function deactivateMaterial(materialId, category) {
    const list = sharedMaterials[category] || [];
    const item = list.find((entry) => entry.id === materialId);
    if (!item) return;
    item.active = false;
    recordAdminAudit("material_deactivate", "material", materialId, `${category}: ${item.title}`);
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Materiál byl skryt.");
  }

  function deleteMaterial(materialId, category) {
    sharedMaterials[category] = (sharedMaterials[category] || []).filter((item) => item.id !== materialId);
    recordAdminAudit("material_delete", "material", materialId, `Odstraněn materiál (${category})`);
    closeAdminMaterialModal();
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Materiál byl odstraněn.");
  }

  function saveHandbookFromForm(handbookId) {
    const form = document.getElementById("adminHandbookForm");
    if (!form) return;
    const title = form.querySelector('[data-field="title"]')?.value.trim() || "";
    const subtitle = form.querySelector('[data-field="subtitle"]')?.value.trim() || "";
    const body = form.querySelector('[data-field="body"]')?.value.trim() || "";
    if (!title) {
      window.LtxApp?.showToast?.("Vyplňte název příručky.");
      return;
    }

    const handbook = window.ProtocolHandbooks?.getProtocolHandbook(handbookId) || { mode: "guide", badges: [] };
    const bodyParagraphs = body ? body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
    const updated = { ...handbook, title, subtitle };

    if (handbook.mode === "checklist") {
      if (bodyParagraphs.length) {
        updated.introBlocks = [{
          title: handbook.introBlocks?.[0]?.title || "Úvod",
          paragraphs: bodyParagraphs
        }];
      }
    } else if (typeof handbook.intro === "string") {
      if (bodyParagraphs.length) updated.intro = bodyParagraphs.join("\n\n");
    } else if (bodyParagraphs.length) {
      updated.intro = [{ paragraphs: bodyParagraphs }];
      if (!updated.blocks?.length) {
        updated.blocks = [{
          title: "Obsah",
          sections: [{ paragraphs: bodyParagraphs }]
        }];
      }
    }

    window.ProtocolHandbooks?.updateHandbook?.(handbookId, updated);
    recordAdminAudit("handbook_update", "handbook", handbookId, `Upravena příručka: ${title}`);
    closeAdminHandbookModal();
    if (onStateChange) onStateChange();
    window.LtxApp?.render?.();
    window.LtxApp?.showToast?.("Příručka byla uložena.");
  }

  function readMaterialAttachmentsFromForm(form) {
    const list = form.querySelector("#adminMaterialAttachList");
    if (!list) return [];
    return [...list.querySelectorAll("[data-attach-id]")].map((row) => ({
      id: row.dataset.attachId,
      name: row.dataset.attachName || "",
      type: row.dataset.attachType || "FILE",
      size: row.dataset.attachSize || "",
      description: row.querySelector(".file-attach-desc")?.value.trim() || ""
    }));
  }

  function renderMaterialAttachmentChip(item) {
    const typeKey = String(item.type || "FILE").toLowerCase().replace(/[^a-z0-9]/g, "");
    return `
      <li
        class="file-attach-row"
        role="listitem"
        data-attach-id="${escapeAdminHtml(item.id)}"
        data-attach-name="${escapeAdminHtml(item.name)}"
        data-attach-type="${escapeAdminHtml(item.type || "FILE")}"
        data-attach-size="${escapeAdminHtml(item.size || "")}"
      >
        <span class="file-chip-icon file-chip-icon--${escapeAdminHtml(typeKey)}" aria-hidden="true">${escapeAdminHtml(item.type || "FILE")}</span>
        <div class="file-attach-main">
          <span class="file-attach-name">${escapeAdminHtml(item.name)}</span>
          <span class="file-attach-meta">${escapeAdminHtml(item.size || "")}</span>
        </div>
        <input type="text" class="file-attach-desc" placeholder="Popis přílohy" value="${escapeAdminHtml(item.description || "")}" aria-label="Popis přílohy ${escapeAdminHtml(item.name)}">
        <button type="button" class="file-chip-remove" data-remove-attach aria-label="Odebrat ${escapeAdminHtml(item.name)}">
          <span aria-hidden="true">×</span>
        </button>
      </li>
    `;
  }

  function renderMaterialAttachmentsField(attachments) {
    const items = attachments || [];
    return `
      <div class="field">
        <label>Přílohy (PDF, dokumenty, obrázky)</label>
        <div class="file-upload">
          <ul class="file-upload-list file-upload-list--desc admin-material-attach-list" id="adminMaterialAttachList" role="list">
            ${items.map((item) => renderMaterialAttachmentChip(item)).join("")}
          </ul>
          <div class="file-upload-actions">
            <button type="button" class="file-upload-add" data-attach-pick="adminMaterialFileInput">
              <span class="file-upload-add-icon" aria-hidden="true">+</span>
              Přidat soubor
            </button>
            <span class="file-upload-hint">Pacient si může přílohy stáhnout v edukaci</span>
            <input
              type="file"
              class="file-upload-input"
              id="adminMaterialFileInput"
              data-attach-list="adminMaterialAttachList"
              data-attach-desc="true"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp4,.mov"
            >
          </div>
        </div>
      </div>
    `;
  }

  function renderAdminBanner() {
    const app = window.LtxApp;
    const inSwitchMode = app?.isAdminModeActive?.();
    const ctx = app?.getDemoState()?.adminReturnContext;
    const baseRole = ctx ? app?.roleById?.(ctx.role)?.name : "";
    
    if (!inSwitchMode) {
      return `
        <div class="admin-mode-banner">
          <div>
            <strong>Správa systému</strong>
            <span>Uživatel s oprávněním ADMIN. Sdílený obsah a uživatelé, ne klinická data pacientů.</span>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="admin-mode-banner">
        <div>
          <strong>Aktuálně jste v režimu správy systému</strong>
          <span>Správa sdíleného obsahu a uživatelů. Klinická data pacientů zde neupravujete.</span>
        </div>
        <button type="button" class="btn warn btn-compact" data-admin-exit>
          Vrátit se do role ${escapeAdminHtml(baseRole || "původní")}
        </button>
      </div>
    `;
  }

  function renderUserActions(user, editKind) {
    return `
      <div class="admin-row-actions">
        ${renderAdminIconButton({
          icon: "edit",
          label: `Upravit ${user.name}`,
          dataAttr: editKind === "patient" ? "admin-edit-patient-portal" : "admin-edit-system-user",
          dataValue: user.id
        })}
        ${user.active !== false
          ? renderAdminIconButton({
            icon: "account-off",
            label: `Deaktivovat účet ${user.name}`,
            extraClass: "med-icon-btn--warn",
            dataAttr: "admin-deactivate-user",
            dataValue: user.id
          })
          : renderAdminIconButton({
            icon: "account-on",
            label: `Aktivovat účet ${user.name}`,
            extraClass: "med-icon-btn--success",
            dataAttr: "admin-activate-user",
            dataValue: user.id
          })}
        ${renderAdminIconButton({
          icon: "remove",
          label: `Smazat ${user.name}`,
          extraClass: "med-icon-btn--danger",
          dataAttr: "admin-delete-user",
          dataValue: user.id
        })}
      </div>
    `;
  }

  function renderUsersTable() {
    const roleName = (roleId) => window.LtxApp?.roleById?.(roleId)?.name || roleId;
    const staffUsers = getStaffUsers(true);
    const portalUsers = getPatientPortalUsers(true);

    return `
      <section class="card admin-section">
        <div class="card-header admin-section-header">
          <div>
            <h3>Uživatelé systému</h3>
            <p class="admin-section-sub">Zaměstnanci a spolupracující pracoviště. Role a oprávnění ADMIN, bez portálových účtů pacientů.</p>
          </div>
          <div class="admin-toolbar-actions">
            ${renderAdminIconButton({
              icon: "plus",
              label: "Nový uživatel systému",
              extraClass: "med-icon-btn--primary admin-toolbar-add-btn",
              dataAttr: "admin-new-system-user"
            })}
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="summary-table admin-table">
            <thead>
              <tr>
                <th>Jméno</th>
                <th>Role</th>
                <th>Pracoviště</th>
                <th>Oprávnění</th>
                <th>Stav</th>
                <th class="admin-actions-cell" aria-label="Akce"></th>
              </tr>
            </thead>
            <tbody>
              ${staffUsers.length
                ? staffUsers.map((user) => `
                  <tr class="${user.active === false ? "is-inactive" : ""}">
                    <td><div class="admin-table-primary-cell"><strong>${escapeAdminHtml(user.name)}</strong><span class="admin-table-meta">${escapeAdminHtml(user.email)}</span></div></td>
                    <td>${escapeAdminHtml(roleName(user.roleId))}</td>
                    <td>${escapeAdminHtml(user.workplace)}</td>
                    <td>${hasAdminPermission(user) ? '<span class="pill ok">ADMIN</span>' : "-"}</td>
                    <td>${user.active === false ? '<span class="pill warn">Deaktivován</span>' : '<span class="pill ok">Aktivní</span>'}</td>
                    <td class="admin-actions-cell">${renderUserActions(user, "system")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="6" class="admin-table-empty">Zatím žádní uživatelé systému.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card admin-section">
        <div class="card-header admin-section-header">
          <div>
            <h3>Portálové účty pacientů</h3>
            <p class="admin-section-sub">Přihlášení do pacientského portálu vázané na klinický záznam. Vazbu na pacienta nastavuje systém, nelze jí měnit ani přiřadit ADMIN.</p>
          </div>
          <div class="admin-toolbar-actions">
            ${renderAdminIconButton({
              icon: "plus",
              label: "Nový portálový účet pacienta",
              extraClass: "med-icon-btn--primary admin-toolbar-add-btn",
              dataAttr: "admin-new-patient-portal"
            })}
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="summary-table admin-table">
            <thead>
              <tr>
                <th>Jméno</th>
                <th>Klinický záznam</th>
                <th>E-mail</th>
                <th>Stav</th>
                <th class="admin-actions-cell" aria-label="Akce"></th>
              </tr>
            </thead>
            <tbody>
              ${portalUsers.length
                ? portalUsers.map((user) => `
                  <tr class="${user.active === false ? "is-inactive" : ""}">
                    <td><div class="admin-table-primary-cell"><strong>${escapeAdminHtml(user.name)}</strong><span class="admin-table-meta">${escapeAdminHtml(user.workplace)}</span></div></td>
                    <td>${escapeAdminHtml(formatPatientRecordLabel(user.patientId))}</td>
                    <td>${escapeAdminHtml(user.email)}</td>
                    <td>${user.active === false ? '<span class="pill warn">Deaktivován</span>' : '<span class="pill ok">Aktivní</span>'}</td>
                    <td class="admin-actions-cell">${renderUserActions(user, "patient")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="5" class="admin-table-empty">Zatím žádné portálové účty pacientů.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSystemUserForm(userId) {
    const isNew = userId === "new";
    const user = isNew
      ? { name: "", roleId: "coordinator", workplace: "", email: "", phone: "", active: true, permissions: [] }
      : (getUserById(userId) || {});

    return `
      <div id="adminUserForm" data-user-form-kind="system">
        ${wrapAdminDrawerShell({
          titleId: "adminUserModalTitle",
          title: isNew ? "Nový uživatel systému" : "Úprava uživatele systému",
          cancelAction: "admin-cancel-user",
          bodyHtml: `
            <p class="admin-sidebar-modal-sub">${isNew
              ? "Účet pro zaměstnance nebo spolupracující pracoviště. ID se vygeneruje automaticky."
              : `Upravujete účet <strong>${escapeAdminHtml(user.name)}</strong>.`}</p>
            ${!isNew ? `
              <div class="admin-sidebar-readonly-meta">
                <span><strong>ID účtu:</strong> ${escapeAdminHtml(user.id)}</span>
              </div>
            ` : ""}
            <div class="field-grid">
              <div class="field"><label>Jméno</label><input data-field="name" value="${escapeAdminHtml(user.name)}"></div>
              <div class="field">
                <label>Role</label>
                <select data-field="roleId">
                  ${getStaffRoleOptions().map((role) => `
                    <option value="${escapeAdminHtml(role.id)}" ${role.id === user.roleId ? "selected" : ""}>${escapeAdminHtml(role.name)}</option>
                  `).join("")}
                </select>
              </div>
              <div class="field"><label>Pracoviště</label><input data-field="workplace" value="${escapeAdminHtml(user.workplace)}"></div>
              <div class="field"><label>E-mail</label><input data-field="email" value="${escapeAdminHtml(user.email)}"></div>
              <div class="field"><label>Telefon</label><input data-field="phone" value="${escapeAdminHtml(user.phone)}"></div>
            </div>
            <label class="exam-checkbox-row"><input type="checkbox" data-field="active" ${user.active !== false ? "checked" : ""}><span>Účet aktivní</span></label>
            <label class="exam-checkbox-row"><input type="checkbox" data-field="perm-admin" ${hasAdminPermission(user) ? "checked" : ""}><span>Oprávnění ADMIN (správa systému)</span></label>
          `,
          footerHtml: `
            <button type="button" class="btn secondary" data-admin-cancel-user>Zrušit</button>
            <button type="button" class="btn" data-admin-save-user="${escapeAdminHtml(userId)}" data-admin-user-form-kind="system">Uložit</button>
          `
        })}
      </div>
    `;
  }

  function renderPatientPortalForm(userId) {
    const isNew = userId === "new";
    const user = isNew
      ? { name: "", email: "", phone: "", active: true, patientId: "" }
      : (getUserById(userId) || {});
    const availablePatients = isNew
      ? getPatientsAvailableForPortal()
      : (user.patientId ? [getPatientById(user.patientId)].filter(Boolean) : []);

    return `
      <div id="adminUserForm" data-user-form-kind="patient">
        ${wrapAdminDrawerShell({
          titleId: "adminUserModalTitle",
          title: isNew ? "Nový portálový účet pacienta" : "Úprava portálového účtu",
          cancelAction: "admin-cancel-user",
          bodyHtml: `
            <p class="admin-sidebar-modal-sub">${isNew
              ? "Propojte klinický záznam pacienta s přihlášením do portálu. Role Pacient a vazba se nastaví automaticky."
              : `Upravujete portál pro <strong>${escapeAdminHtml(user.name)}</strong>.`}</p>
            ${!isNew ? `
              <div class="admin-sidebar-readonly-meta">
                <span><strong>ID účtu:</strong> ${escapeAdminHtml(user.id)}</span>
                <span><strong>Klinický záznam:</strong> ${escapeAdminHtml(formatPatientRecordLabel(user.patientId))} <em>(nelze měnit)</em></span>
              </div>
            ` : ""}
            <div class="field-grid">
              ${isNew ? `
                <div class="field field-span-all">
                  <label>Pacient</label>
                  <select data-field="patientId" required>
                    <option value="">Vyberte pacienta</option>
                    ${availablePatients.map((patient) => `
                      <option value="${escapeAdminHtml(patient.id)}">${escapeAdminHtml(patient.name)} (${escapeAdminHtml(patient.id)})</option>
                    `).join("")}
                  </select>
                </div>
              ` : ""}
              <div class="field"><label>Jméno v portálu</label><input data-field="name" value="${escapeAdminHtml(user.name)}"></div>
              <div class="field"><label>E-mail</label><input data-field="email" type="email" value="${escapeAdminHtml(user.email)}"></div>
              <div class="field"><label>Telefon</label><input data-field="phone" value="${escapeAdminHtml(user.phone)}"></div>
            </div>
            <label class="exam-checkbox-row"><input type="checkbox" data-field="active" ${user.active !== false ? "checked" : ""}><span>Účet aktivní (pacient se může přihlásit)</span></label>
          `,
          footerHtml: `
            <button type="button" class="btn secondary" data-admin-cancel-user>Zrušit</button>
            <button type="button" class="btn" data-admin-save-user="${escapeAdminHtml(userId)}" data-admin-user-form-kind="patient">Uložit</button>
          `
        })}
      </div>
    `;
  }

  function renderCodeListsSection() {
    const phasesText = (codeLists.phases || []).map((item) => `${item.code}|${item.label}`).join("\n");
    const symptomsText = (codeLists.patientDailySymptoms || []).map((item) => `${item.id}|${item.label}`).join("\n");
    const alertsText = (codeLists.alertLevels || []).join("\n");

    return `
      <section class="card admin-section">
        <div class="card-header">
          <div>
            <h3>Číselníky</h3>
            <p class="admin-section-sub">Formát řádku: kód|popisek. Úrovně podnětů: jeden řádek = jedna hodnota.</p>
          </div>
        </div>
        <div class="admin-code-grid">
          <div class="field">
            <label for="adminCodePhases">Fáze cesty pacienta</label>
            <textarea id="adminCodePhases" rows="6">${escapeAdminHtml(phasesText)}</textarea>
          </div>
          <div class="field">
            <label for="adminCodeSymptoms">Symptomy domácího záznamu</label>
            <textarea id="adminCodeSymptoms" rows="8">${escapeAdminHtml(symptomsText)}</textarea>
          </div>
          <div class="field">
            <label for="adminCodeAlerts">Úrovně podnětů</label>
            <textarea id="adminCodeAlerts" rows="5">${escapeAdminHtml(alertsText)}</textarea>
          </div>
        </div>
        <div class="item-actions admin-form-actions">
          <button type="button" class="btn" data-admin-save-codelists>Uložit číselníky</button>
        </div>
      </section>
    `;
  }

  function renderMaterialActions(item, category) {
    const ref = `${category}:${item.id}`;
    return `
      <div class="admin-row-actions">
        ${renderAdminIconButton({
          icon: "edit",
          label: `Upravit materiál ${item.title}`,
          dataAttr: "admin-edit-material",
          dataValue: ref
        })}
        ${item.active !== false
          ? renderAdminIconButton({
            icon: "account-off",
            label: `Skrýt materiál ${item.title}`,
            extraClass: "med-icon-btn--warn",
            dataAttr: "admin-deactivate-material",
            dataValue: ref
          })
          : renderAdminIconButton({
            icon: "account-on",
            label: `Zobrazit materiál ${item.title}`,
            extraClass: "med-icon-btn--success",
            dataAttr: "admin-activate-material",
            dataValue: ref
          })}
        ${renderAdminIconButton({
          icon: "remove",
          label: `Smazat materiál ${item.title}`,
          extraClass: "med-icon-btn--danger",
          dataAttr: "admin-delete-material",
          dataValue: ref
        })}
      </div>
    `;
  }

  function renderMaterialsSection() {
    return `
      <div class="admin-materials-grid">
        ${renderMaterialCategory("psych", "Psychologické materiály", sharedMaterials.psych || [])}
        ${renderMaterialCategory("rehab", "Fyzio / rehabilitační materiály", sharedMaterials.rehab || [])}
      </div>
    `;
  }

  function renderMaterialCategory(category, title, items) {
    return `
      <section class="card admin-section">
        <div class="card-header admin-section-header">
          <div>
            <h3>${escapeAdminHtml(title)}</h3>
            <p class="admin-section-sub">Sdílené edukační materiály pro pacienty a tým. Skrytý materiál zůstane v systému, ale nebude nabízen.</p>
          </div>
          <div class="admin-toolbar-actions">
            ${renderAdminIconButton({
              icon: "plus",
              label: "Nový materiál",
              extraClass: "med-icon-btn--primary admin-toolbar-add-btn",
              dataAttr: "admin-new-material",
              dataValue: category
            })}
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="summary-table admin-table">
            <thead>
              <tr>
                <th>Název</th>
                <th>Autor</th>
                <th>Délka</th>
                <th>Přílohy</th>
                <th>Stav</th>
                <th class="admin-actions-cell" aria-label="Akce"></th>
              </tr>
            </thead>
            <tbody>
              ${items.length
                ? items.map((item) => `
                  <tr class="${item.active === false ? "is-inactive" : ""}">
                    <td><div class="admin-table-primary-cell"><strong>${escapeAdminHtml(item.title)}</strong><span class="admin-table-meta">${escapeAdminHtml(item.category)}</span></div></td>
                    <td>${escapeAdminHtml(item.author)}</td>
                    <td>${escapeAdminHtml(item.duration)}</td>
                    <td>${(item.attachments || []).length || "-"}</td>
                    <td>${item.active === false ? '<span class="pill warn">Skrytý</span>' : '<span class="pill ok">Aktivní</span>'}</td>
                    <td class="admin-actions-cell">${renderMaterialActions(item, category)}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="6" class="admin-table-empty">Zatím žádné materiály v této kategorii.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderMaterialForm(category, materialId) {
    const isNew = materialId === "new";
    const item = isNew
      ? { title: "", category: category === "psych" ? "Psychika & podpora" : "Rehabilitace", duration: "", author: "", description: "", audience: "WL", active: true, attachments: [] }
      : ((sharedMaterials[category] || []).find((entry) => entry.id === materialId) || {});
    const categoryLabel = category === "psych" ? "Psychologické materiály" : "Fyzio / rehabilitační materiály";

    return `
      <div id="adminMaterialForm" data-material-category="${escapeAdminHtml(category)}">
        ${wrapAdminDrawerShell({
          titleId: "adminMaterialModalTitle",
          title: isNew ? "Nový materiál" : "Úprava materiálu",
          cancelAction: "admin-cancel-material",
          bodyHtml: `
            <p class="admin-sidebar-modal-sub">${isNew
              ? `Přidáváte materiál do kategorie ${escapeAdminHtml(categoryLabel)}.`
              : `Upravujete materiál <strong>${escapeAdminHtml(item.title)}</strong>.`}</p>
            ${!isNew ? `
              <div class="admin-sidebar-readonly-meta">
                <span><strong>ID materiálu:</strong> ${escapeAdminHtml(item.id)}</span>
                <span><strong>Kategorie:</strong> ${escapeAdminHtml(categoryLabel)}</span>
              </div>
            ` : ""}
            <div class="field-grid">
              <div class="field"><label>Název</label><input data-field="title" value="${escapeAdminHtml(item.title)}"></div>
              <div class="field"><label>Podkategorie</label><input data-field="category" value="${escapeAdminHtml(item.category)}"></div>
              <div class="field"><label>Délka</label><input data-field="duration" value="${escapeAdminHtml(item.duration)}"></div>
              <div class="field"><label>Autor</label><input data-field="author" value="${escapeAdminHtml(item.author)}"></div>
              <div class="field">
                <label>Cílová skupina</label>
                <select data-field="audience">
                  <option value="ALL" ${item.audience === "ALL" ? "selected" : ""}>Všichni pacienti</option>
                  <option value="WL" ${item.audience === "WL" ? "selected" : ""}>Čekací listina (WL)</option>
                  <option value="PO_TX" ${item.audience === "PO_TX" ? "selected" : ""}>Po transplantaci</option>
                </select>
              </div>
            </div>
            <div class="field admin-material-desc-field"><label>Popis</label><textarea data-field="description" rows="4">${escapeAdminHtml(item.description)}</textarea></div>
            <div class="admin-material-attachments-wrap">
              ${renderMaterialAttachmentsField(item.attachments || [])}
            </div>
            <div class="admin-material-active-wrap">
              <label class="exam-checkbox-row"><input type="checkbox" data-field="active" ${item.active !== false ? "checked" : ""}><span>Materiál aktivní (viditelný)</span></label>
            </div>
          `,
          footerHtml: `
            <button type="button" class="btn secondary" data-admin-cancel-material>Zrušit</button>
            <button type="button" class="btn" data-admin-save-material="${escapeAdminHtml(materialId)}" data-admin-material-category="${escapeAdminHtml(category)}">Uložit</button>
          `
        })}
      </div>
    `;
  }

  function renderHandbooksSection() {
    const handbookIds = window.ProtocolHandbooks?.listHandbookIds?.() || [];
    const rows = handbookIds.map((id) => {
      const hb = window.ProtocolHandbooks?.getProtocolHandbook(id);
      return { id, title: hb?.title || id, subtitle: hb?.subtitle || "" };
    });

    return `
      <section class="card admin-section">
        <div class="card-header admin-section-header">
          <div>
            <h3>Příručky a protokoly</h3>
            <p class="admin-section-sub">Úprava názvu, popisu a textového obsahu. Změna se projeví u všech rolí s přístupem.</p>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="summary-table admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Název</th>
                <th>Popis</th>
                <th class="admin-actions-cell" aria-label="Akce"></th>
              </tr>
            </thead>
            <tbody>
              ${rows.length
                ? rows.map((row) => `
                  <tr>
                    <td><code>${escapeAdminHtml(row.id)}</code></td>
                    <td><strong>${escapeAdminHtml(row.title)}</strong></td>
                    <td>${escapeAdminHtml(row.subtitle)}</td>
                    <td class="admin-actions-cell">
                      <div class="admin-row-actions">
                        ${renderAdminIconButton({
                          icon: "edit",
                          label: `Upravit příručku ${row.title}`,
                          dataAttr: "admin-edit-handbook",
                          dataValue: row.id
                        })}
                      </div>
                    </td>
                  </tr>
                `).join("")
                : `<tr><td colspan="4" class="admin-table-empty">Zatím žádné příručky.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function handbookBodyText(handbook) {
    if (!handbook) return "";
    const parts = [];

    if (typeof handbook.intro === "string" && handbook.intro.trim()) {
      parts.push(handbook.intro.trim());
    } else if (Array.isArray(handbook.intro) && handbook.intro.length) {
      parts.push(...handbook.intro.flatMap((block) => block.paragraphs || []));
    }

    if (handbook.mode === "checklist" && handbook.introBlocks?.length) {
      parts.push(...handbook.introBlocks.flatMap((block) => block.paragraphs || []));
    }

    if (handbook.blocks?.length) {
      handbook.blocks.forEach((block) => {
        (block.sections || []).forEach((section) => {
          if (section.paragraphs?.length) parts.push(...section.paragraphs);
          if (section.items?.length) parts.push(...section.items);
        });
      });
    }

    return parts.join("\n\n");
  }

  function renderHandbookForm(handbookId) {
    const handbook = window.ProtocolHandbooks?.getProtocolHandbook(handbookId) || {};
    const isChecklist = handbook.mode === "checklist";
    return `
      <div id="adminHandbookForm">
        ${wrapAdminDrawerShell({
          titleId: "adminHandbookModalTitle",
          title: "Úprava příručky",
          cancelAction: "admin-cancel-handbook",
          bodyHtml: `
            <p class="admin-sidebar-modal-sub">Upravujete příručku <strong>${escapeAdminHtml(handbook.title || handbookId)}</strong>. Změna se projeví u všech rolí s přístupem.</p>
            ${isChecklist ? `<p class="admin-sidebar-modal-sub">Checklist položky zůstávají beze změny. Upravujete název, popis a úvodní text.</p>` : ""}
            <div class="admin-sidebar-readonly-meta">
              <span><strong>ID příručky:</strong> <code>${escapeAdminHtml(handbookId)}</code></span>
              <span><strong>Typ:</strong> ${isChecklist ? "Checklist protokol" : "Průvodce"}</span>
            </div>
            <div class="field-grid">
              <div class="field field-span-all"><label>Název</label><input data-field="title" value="${escapeAdminHtml(handbook.title || "")}"></div>
              <div class="field field-span-all"><label>Krátký popis</label><input data-field="subtitle" value="${escapeAdminHtml(handbook.subtitle || "")}"></div>
            </div>
            <div class="field"><label>Textový obsah (odstavce oddělte prázdným řádkem)</label><textarea data-field="body" rows="12">${escapeAdminHtml(handbookBodyText(handbook))}</textarea></div>
          `,
          footerHtml: `
            <button type="button" class="btn secondary" data-admin-cancel-handbook>Zrušit</button>
            <button type="button" class="btn" data-admin-save-handbook="${escapeAdminHtml(handbookId)}">Uložit</button>
          `
        })}
      </div>
    `;
  }

  function renderAuditSection() {
    return `
      <section class="card admin-section">
        <div class="card-header">
          <div>
            <h3>Audit správy systému</h3>
            <p class="admin-section-sub">Kdo, kdy a pod jakou rolí provedl změnu ve správě (uživatelé, číselníky, materiály, příručky).</p>
          </div>
        </div>
        <div class="admin-audit-list">
          ${adminAudit.length ? adminAudit.map((entry) => `
            <article class="admin-audit-row">
              <div class="admin-audit-meta">${escapeAdminHtml(entry.at)} · ${escapeAdminHtml(entry.actorName)} · role ${escapeAdminHtml(entry.actingRole)}</div>
              <strong>${escapeAdminHtml(entry.action)}</strong>
              <span>${escapeAdminHtml(entry.detail)}</span>
            </article>
          `).join("") : '<p class="admin-section-sub">Zatím žádné záznamy správy.</p>'}
        </div>
      </section>
    `;
  }

  function renderFaqsSection() {
    return `
      <section class="card admin-section">
        <div class="card-header admin-section-header">
          <div>
            <h3>FAQ pro pacienty</h3>
            <p class="admin-section-sub">Správa často kladených dotazů, které se zobrazují pacientům v portálu podle jejich aktuální fáze.</p>
          </div>
          <div class="admin-toolbar-actions">
            ${renderAdminIconButton({
              icon: "plus",
              label: "Nový FAQ dotaz",
              extraClass: "med-icon-btn--primary admin-toolbar-add-btn",
              dataAttr: "admin-new-faq"
            })}
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="summary-table admin-table">
            <thead>
              <tr>
                <th style="width: 25%;">Otázka</th>
                <th>Odpověď</th>
                <th style="width: 15%;">Fáze</th>
                <th class="admin-actions-cell" aria-label="Akce"></th>
              </tr>
            </thead>
            <tbody>
              ${systemFaqs.length
                ? systemFaqs.map((faq) => `
                  <tr>
                    <td><strong>${escapeAdminHtml(faq.question)}</strong></td>
                    <td><div class="admin-table-text-truncate" title="${escapeAdminHtml(faq.answer)}">${escapeAdminHtml(faq.answer)}</div></td>
                    <td><span class="pill">${escapeAdminHtml(faq.state)}</span></td>
                    <td class="admin-actions-cell">
                      <div class="admin-row-actions">
                        ${renderAdminIconButton({
                          icon: "edit",
                          label: "Upravit FAQ",
                          dataAttr: "admin-edit-faq",
                          dataValue: faq.id
                        })}
                        ${renderAdminIconButton({
                          icon: "delete",
                          label: "Smazat FAQ",
                          extraClass: "med-icon-btn--warn",
                          dataAttr: "admin-delete-faq",
                          dataValue: faq.id
                        })}
                      </div>
                    </td>
                  </tr>
                `).join("")
                : `<tr><td colspan="4" class="admin-table-empty">Zatím žádné FAQ dotazy.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderFaqForm(faqId) {
    const isNew = faqId === "new";
    const faq = isNew
      ? { id: `faq-${Date.now()}`, question: "", answer: "", state: "POSUZOVANI" }
      : systemFaqs.find((f) => f.id === faqId);

    if (!faq) return "<p>FAQ nenalezeno.</p>";

    const states = [
      { id: "POSUZOVANI", label: "Posuzování" },
      { id: "WL", label: "Čekací listina" },
      { id: "PO_TX", label: "Po transplantaci" }
    ];

    return `
      <div id="adminFaqForm">
        ${wrapAdminDrawerShell({
          titleId: "adminMaterialModalTitle",
          title: isNew ? "Nový FAQ dotaz" : "Upravit FAQ dotaz",
          cancelAction: "admin-cancel-material",
          bodyHtml: `
            <input type="hidden" id="faqId" value="${faq.id}">
            <div class="field">
              <label for="faqQuestion">Otázka</label>
              <input type="text" id="faqQuestion" value="${escapeAdminHtml(faq.question)}" required>
            </div>
            <div class="field">
              <label for="faqAnswer">Odpověď</label>
              <textarea id="faqAnswer" rows="6" required>${escapeAdminHtml(faq.answer)}</textarea>
            </div>
            <div class="field">
              <label for="faqState">Zobrazit ve fázi</label>
              <select id="faqState" required>
                ${states.map((s) => `<option value="${s.id}" ${faq.state === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
              </select>
            </div>
          `,
          footerHtml: `
            <button type="button" class="btn secondary" data-admin-cancel-material>Zrušit</button>
            <button type="button" class="btn" data-admin-save-faq>Uložit</button>
          `
        })}
      </div>
    `;
  }

  function saveFaqFromForm() {
    const id = document.getElementById("faqId")?.value;
    const question = document.getElementById("faqQuestion")?.value.trim();
    const answer = document.getElementById("faqAnswer")?.value.trim();
    const state = document.getElementById("faqState")?.value;

    if (!question || !answer) {
      alert("Vyplňte prosím otázku i odpověď.");
      return;
    }

    const existingIndex = systemFaqs.findIndex((f) => f.id === id);
    if (existingIndex > -1) {
      systemFaqs[existingIndex] = { id, question, answer, state };
      recordAdminAudit(`Upraven FAQ dotaz: ${question}`);
    } else {
      systemFaqs.push({ id, question, answer, state });
      recordAdminAudit(`Vytvořen nový FAQ dotaz: ${question}`);
    }

    closeAdminModals();
    if (onStateChange) onStateChange();
  }

  function closeAdminModals() {
    document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    window.LtxApp?.syncPageScrollLock?.();
  }

  function deleteFaq(faqId) {
    const faq = systemFaqs.find((f) => f.id === faqId);
    if (!faq) return;

    systemFaqs = systemFaqs.filter((f) => f.id !== faqId);
    recordAdminAudit(`Smazán FAQ dotaz: ${faq.question}`);
    if (onStateChange) onStateChange();
  }

  function renderAdminWorkspace(mainTab) {
    const tab = mainTab || "admin-users";
    let body = "";
    if (tab === "admin-users") body = renderUsersTable();
    else if (tab === "admin-codelists") body = renderCodeListsSection();
    else if (tab === "admin-materials") body = renderMaterialsSection();
    else if (tab === "admin-faqs") body = renderFaqsSection();
    else if (tab === "admin-handbooks") body = renderHandbooksSection();
    else if (tab === "admin-audit") body = renderAuditSection();
    else body = renderUsersTable();

    return `
      <div class="admin-workspace">
        ${renderAdminBanner()}
        ${body}
      </div>
    `;
  }

  function wireAdminPageEventsOnce() {
    if (wireAdminPageEventsOnce.done) return;
    wireAdminPageEventsOnce.done = true;

    document.addEventListener("click", (event) => {
      const exitBtn = event.target.closest("[data-admin-exit]");
      if (exitBtn) {
        event.preventDefault();
        if (exitAdminMode()) window.LtxApp?.render?.();
        return;
      }

      const enterBtn = event.target.closest("[data-admin-enter]");
      if (enterBtn) {
        event.preventDefault();
        if (enterAdminMode()) window.LtxApp?.render?.();
        return;
      }

      const newSystemBtn = event.target.closest("[data-admin-new-system-user]");
      if (newSystemBtn) {
        event.preventDefault();
        openAdminUserModal("new", "system");
        return;
      }

      const newPatientBtn = event.target.closest("[data-admin-new-patient-portal]");
      if (newPatientBtn) {
        event.preventDefault();
        openAdminUserModal("new", "patient");
        return;
      }

      const editSystemBtn = event.target.closest("[data-admin-edit-system-user]");
      if (editSystemBtn) {
        event.preventDefault();
        openAdminUserModal(editSystemBtn.dataset.adminEditSystemUser, "system");
        return;
      }

      const editPatientBtn = event.target.closest("[data-admin-edit-patient-portal]");
      if (editPatientBtn) {
        event.preventDefault();
        openAdminUserModal(editPatientBtn.dataset.adminEditPatientPortal, "patient");
        return;
      }

      const deactivateUserBtn = event.target.closest("[data-admin-deactivate-user]");
      if (deactivateUserBtn) {
        event.preventDefault();
        deactivateUser(deactivateUserBtn.dataset.adminDeactivateUser);
        return;
      }

      const activateUserBtn = event.target.closest("[data-admin-activate-user]");
      if (activateUserBtn) {
        event.preventDefault();
        activateUser(activateUserBtn.dataset.adminActivateUser);
        return;
      }

      const deleteUserBtn = event.target.closest("[data-admin-delete-user]");
      if (deleteUserBtn) {
        event.preventDefault();
        if (window.confirm("Opravdu smazat uživatele?")) {
          deleteUser(deleteUserBtn.dataset.adminDeleteUser);
        }
        return;
      }

      const saveCodelistsBtn = event.target.closest("[data-admin-save-codelists]");
      if (saveCodelistsBtn) {
        event.preventDefault();
        saveCodeListsFromForm();
        return;
      }

      const newMaterialBtn = event.target.closest("[data-admin-new-material]");
      if (newMaterialBtn) {
        event.preventDefault();
        openAdminMaterialModal(newMaterialBtn.dataset.adminNewMaterial, "new");
        return;
      }

      const editMaterialBtn = event.target.closest("[data-admin-edit-material]");
      if (editMaterialBtn) {
        event.preventDefault();
        const [category, id] = editMaterialBtn.dataset.adminEditMaterial.split(":");
        openAdminMaterialModal(category, id);
        return;
      }

      const deactivateMaterialBtn = event.target.closest("[data-admin-deactivate-material]");
      if (deactivateMaterialBtn) {
        event.preventDefault();
        const [category, id] = deactivateMaterialBtn.dataset.adminDeactivateMaterial.split(":");
        deactivateMaterial(id, category);
        return;
      }

      const activateMaterialBtn = event.target.closest("[data-admin-activate-material]");
      if (activateMaterialBtn) {
        event.preventDefault();
        const [category, id] = activateMaterialBtn.dataset.adminActivateMaterial.split(":");
        activateMaterial(id, category);
        return;
      }

      const deleteMaterialBtn = event.target.closest("[data-admin-delete-material]");
      if (deleteMaterialBtn) {
        event.preventDefault();
        const [category, id] = deleteMaterialBtn.dataset.adminDeleteMaterial.split(":");
        if (window.confirm("Opravdu smazat materiál?")) deleteMaterial(id, category);
        return;
      }

      const editHandbookBtn = event.target.closest("[data-admin-edit-handbook]");
      if (editHandbookBtn) {
        event.preventDefault();
        openAdminHandbookModal(editHandbookBtn.dataset.adminEditHandbook);
        return;
      }

      const newFaqBtn = event.target.closest("[data-admin-new-faq]");
      if (newFaqBtn) {
        event.preventDefault();
        openAdminFaqModal("new");
        return;
      }

      const editFaqBtn = event.target.closest("[data-admin-edit-faq]");
      if (editFaqBtn) {
        event.preventDefault();
        openAdminFaqModal(editFaqBtn.dataset.adminEditFaq);
        return;
      }

      const deleteFaqBtn = event.target.closest("[data-admin-delete-faq]");
      if (deleteFaqBtn) {
        event.preventDefault();
        if (window.confirm("Opravdu smazat tento FAQ dotaz?")) {
          deleteFaq(deleteFaqBtn.dataset.adminDeleteFaq);
        }
        return;
      }
    });
  }

  function openAdminFaqModal(faqId) {
    wireAdminMaterialModalOnce();
    const modal = document.getElementById("adminMaterialModal");
    const body = document.getElementById("adminMaterialModalBody");
    if (!modal || !body) return;

    body.innerHTML = renderFaqForm(faqId);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    window.LtxApp?.syncPageScrollLock?.();
    body.querySelector("#faqQuestion")?.focus();
  }

  function attachAdminEvents() {
    wireAdminUserModalOnce();
    wireAdminMaterialModalOnce();
    wireAdminHandbookModalOnce();
    wireAdminPageEventsOnce();
  }

  function getPatientPortalUser(patient) {
    if (!patient?.id) return null;
    return systemUsers.find((item) => item.patientId === patient.id && item.roleId === "patient") || null;
  }

  function ensureInactivePatientPortalUser(patient, options = {}) {
    if (!patient?.id) return { ok: false, reason: "missing_patient" };

    const email = String(patient.demographics?.email || patient.portalEmail || "").trim().toLowerCase();
    if (!email) return { ok: false, reason: "missing_email" };

    const displayName = patient.name
      || `${patient.demographics?.firstName || ""} ${patient.demographics?.lastName || ""}`.trim();
    const phone = patient.demographics?.phone || "";
    const createdAt = options.createdAt || formatAdminTimestamp();

    let user = getPatientPortalUser(patient);
    const created = !user;
    if (!user) {
      user = {
        id: `u-patient-${patient.id}`,
        name: displayName,
        roleId: "patient",
        workplace: "Pacient v posuzování",
        email,
        phone,
        patientId: patient.id,
        active: false,
        permissions: []
      };
      systemUsers.push(user);
    } else {
      user.active = false;
      user.email = email;
      user.name = displayName;
      if (phone) user.phone = phone;
      if (user.workplace === "Pacient na čekací listině" && patient.state !== "WL") {
        user.workplace = "Pacient v posuzování";
      }
    }

    patient.portalEmail = email;
    patient.portalActivated = false;
    patient.portalPending = true;
    patient.portalCreatedAt = patient.portalCreatedAt || createdAt;
    if (patient.demographics) patient.demographics.email = email;

    if (onStateChange) onStateChange();
    return { ok: true, user, email, created };
  }

  function syncPatientPortalUserProfile(patient) {
    const user = getPatientPortalUser(patient);
    if (!user || !patient?.id) return { ok: false, reason: "missing_user" };

    const email = String(patient.demographics?.email || patient.portalEmail || "").trim().toLowerCase();
    const displayName = patient.name
      || `${patient.demographics?.firstName || ""} ${patient.demographics?.lastName || ""}`.trim();
    const phone = patient.demographics?.phone || "";

    if (email) {
      user.email = email;
      patient.portalEmail = email;
      if (patient.demographics) patient.demographics.email = email;
    }
    if (displayName) user.name = displayName;
    if (phone) user.phone = phone;

    if (onStateChange) onStateChange();
    return { ok: true, user, email };
  }

  function activatePatientPortalUser(patient, options = {}) {
    if (!patient?.id) return { ok: false, reason: "missing_patient" };

    const email = String(patient.demographics?.email || patient.portalEmail || "").trim().toLowerCase();
    if (!email) return { ok: false, reason: "missing_email" };

    const displayName = patient.name
      || `${patient.demographics?.firstName || ""} ${patient.demographics?.lastName || ""}`.trim();
    const phone = patient.demographics?.phone || "";
    const activatedAt = options.activatedAt || formatAdminTimestamp();
    const alreadyActive = patient.portalActivated === true;

    let user = getPatientPortalUser(patient);
    const wasInactive = Boolean(user && user.active === false);
    if (!user) {
      user = {
        id: `u-patient-${patient.id}`,
        name: displayName,
        roleId: "patient",
        workplace: "Pacient na čekací listině",
        email,
        phone,
        patientId: patient.id,
        active: true,
        permissions: []
      };
      systemUsers.push(user);
    } else {
      user.active = true;
      user.email = email;
      user.name = displayName;
      user.workplace = "Pacient na čekací listině";
      if (phone) user.phone = phone;
    }

    patient.portalEmail = email;
    patient.portalActivated = true;
    patient.portalPending = false;
    patient.portalActivatedAt = activatedAt;
    if (patient.demographics) patient.demographics.email = email;

    if (onStateChange) onStateChange();
    return {
      ok: true,
      user,
      email,
      alreadyActive,
      reactivated: wasInactive || Boolean(patient.portalPending && !alreadyActive)
    };
  }

  function getExportState() {
    return {
      systemUsers,
      codeLists,
      sharedMaterials,
      faqs: systemFaqs,
      handbooks: window.ProtocolHandbooks?.getHandbooksState?.() || null,
      handbookCatalogByRole: window.ProtocolHandbooks?.getCatalogState?.() || null,
      adminAudit
    };
  }

  function init(options = {}) {
    if (options.systemUsers?.length) systemUsers = options.systemUsers;
    if (options.codeLists) codeLists = options.codeLists;
    if (options.sharedMaterials) sharedMaterials = options.sharedMaterials;
    if (options.faqs) systemFaqs = options.faqs;
    if (options.adminAudit) adminAudit = options.adminAudit;
    roleOptions = options.roles || [];
    onStateChange = options.onStateChange || null;
  }

  window.LtxAdmin = {
    init,
    getUsers,
    getUserById,
    hasAdminPermission,
    enterAdminMode,
    exitAdminMode,
    recordAdminAudit,
    renderAdminWorkspace,
    attachAdminEvents,
    getExportState,
    activatePatientPortalUser,
    ensureInactivePatientPortalUser,
    syncPatientPortalUserProfile,
    getPatientPortalUser,
    getSharedMaterials: () => sharedMaterials,
    getCodeLists: () => codeLists
  };
})();
