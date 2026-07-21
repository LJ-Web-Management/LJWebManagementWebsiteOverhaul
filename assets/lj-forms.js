/*
 * LJ Web — shared form-submission script.
 * Included on the Contact Us page, and (once rebuilt by industry/role)
 * every product-detail automation page.
 *
 * Wires up any <form data-lj-form="contact|product-lead"> on the page:
 *   - auto-fills the hidden page_url field with the current full URL
 *   - traps bots with a hidden honeypot field
 *   - validates required fields client-side
 *   - POSTs JSON to the matching Supabase Edge Function
 *   - shows an inline success/error message and resets the form on success
 *
 * SETUP: after you create your Supabase project (see SETUP.md), replace
 * SUPABASE_FUNCTIONS_BASE below with your project's Edge Functions URL,
 * e.g. "https://abcdefghijk.functions.supabase.co".
 */
(function () {
  "use strict";

  var SUPABASE_FUNCTIONS_BASE = "https://YOUR-PROJECT-REF.functions.supabase.co";

  var ENDPOINTS = {
    "contact": SUPABASE_FUNCTIONS_BASE + "/submit-contact",
    "product-lead": SUPABASE_FUNCTIONS_BASE + "/submit-product-lead",
  };

  function qs(form, sel) { return form.querySelector(sel); }

  function fieldValue(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : "";
  }

  function setFieldError(form, name, message) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    el.classList.toggle("lj-input-error", !!message);
    var wrap = el.closest(".lj-field") || el.parentElement;
    if (!wrap) return;
    var err = wrap.querySelector(".lj-field-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "lj-field-error";
      wrap.appendChild(err);
    }
    err.textContent = message || "";
  }

  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function showMessage(form, kind, text) {
    var msg = qs(form, ".lj-form-msg");
    if (!msg) return;
    msg.textContent = text;
    msg.className = "lj-form-msg lj-form-msg-" + kind;
  }

  function setSubmitting(form, isSubmitting) {
    var btn = qs(form, ".lj-submit-btn");
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.textContent = isSubmitting ? "Sending..." : btn.getAttribute("data-original-label") || "Submit";
  }

  function validateContact(form) {
    var ok = true;
    var name = fieldValue(form, "name");
    var email = fieldValue(form, "email");
    var subject = fieldValue(form, "subject");
    var message = fieldValue(form, "message");

    setFieldError(form, "name", name ? "" : "Please enter your name.");
    if (!name) ok = false;
    setFieldError(form, "email", isValidEmail(email) ? "" : "Please enter a valid email.");
    if (!isValidEmail(email)) ok = false;
    setFieldError(form, "subject", subject ? "" : "Please enter a subject.");
    if (!subject) ok = false;
    setFieldError(form, "message", message ? "" : "Please enter a message.");
    if (!message) ok = false;

    return ok;
  }

  function validateProductLead(form) {
    var ok = true;
    var name = fieldValue(form, "name");
    var email = fieldValue(form, "email");

    setFieldError(form, "name", name ? "" : "Please enter your name.");
    if (!name) ok = false;
    setFieldError(form, "email", isValidEmail(email) ? "" : "Please enter a valid email.");
    if (!isValidEmail(email)) ok = false;

    return ok;
  }

  function collectPayload(form, kind) {
    if (kind === "contact") {
      return {
        name: fieldValue(form, "name"),
        phone: fieldValue(form, "phone"),
        email: fieldValue(form, "email"),
        subject: fieldValue(form, "subject"),
        message: fieldValue(form, "message"),
        source_url: window.location.href,
        company_hp: fieldValue(form, "company_hp"),
      };
    }
    return {
      name: fieldValue(form, "name"),
      phone: fieldValue(form, "phone"),
      email: fieldValue(form, "email"),
      page_url: window.location.href,
      company_hp: fieldValue(form, "company_hp"),
    };
  }

  function wireForm(form) {
    var kind = form.getAttribute("data-lj-form");
    var endpoint = ENDPOINTS[kind];
    if (!endpoint) return;

    // Auto-fill hidden page_url field on load (product-lead forms).
    var pageUrlField = form.querySelector(".lj-page-url");
    if (pageUrlField) pageUrlField.value = window.location.href;

    var submitBtn = qs(form, ".lj-submit-btn");
    if (submitBtn) submitBtn.setAttribute("data-original-label", submitBtn.textContent);

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var payload = collectPayload(form, kind);

      // Honeypot: if the trap field got filled, silently "succeed" without
      // ever hitting the network — real users never see or fill this field.
      if (payload.company_hp) {
        showMessage(form, "success", "Thanks! We'll be in touch shortly.");
        form.reset();
        return;
      }

      var valid = kind === "contact" ? validateContact(form) : validateProductLead(form);
      if (!valid) {
        showMessage(form, "error", "Please fix the highlighted fields.");
        return;
      }

      setSubmitting(form, true);
      showMessage(form, "", "");

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          setSubmitting(form, false);
          if (result.ok) {
            showMessage(form, "success", "Thanks! We'll be in touch shortly.");
            form.reset();
            if (pageUrlField) pageUrlField.value = window.location.href;
          } else {
            showMessage(form, "error", (result.data && result.data.error) || "Something went wrong. Please try again.");
          }
        })
        .catch(function () {
          setSubmitting(form, false);
          showMessage(form, "error", "Network error — please check your connection and try again.");
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll("form[data-lj-form]");
    for (var i = 0; i < forms.length; i++) wireForm(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
