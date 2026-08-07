(function () {
  "use strict";

  const TOKEN_KEY = "gfloor_admin_review_token";

  function addSyncButton() {
    const refreshButton = document.getElementById("gfloor-admin-refresh");
    if (!refreshButton || document.getElementById("gfloor-outlook-sync")) {
      return;
    }

    const syncButton = document.createElement("button");
    syncButton.id = "gfloor-outlook-sync";
    syncButton.type = "button";
    syncButton.className = "gfloor-button gfloor-button-secondary";
    syncButton.textContent = "Sync Outlook";
    syncButton.title = "Pull new Customer Service email conversations into Pending Review";

    refreshButton.parentNode.insertBefore(syncButton, refreshButton);

    syncButton.addEventListener("click", async function () {
      const token = sessionStorage.getItem(TOKEN_KEY) || "";
      if (!token) {
        window.alert("Please reconnect to the review dashboard before syncing Outlook.");
        return;
      }

      const originalText = syncButton.textContent;
      syncButton.disabled = true;
      syncButton.textContent = "Syncing Outlook…";

      try {
        const response = await fetch("/admin/outlook-sync", {
          method: "POST",
          headers: {
            "X-Admin-Token": token,
            "Accept": "application/json"
          }
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Outlook sync failed.");
        }

        const summary = data.summary || (data.status && data.status.lastSummary) || {};
        const inserted = Number.isFinite(summary.inserted) ? summary.inserted : 0;
        const matched = Number.isFinite(summary.matchedPairs) ? summary.matchedPairs : 0;
        const skipped = Number.isFinite(summary.existingRecordsSkipped) ? summary.existingRecordsSkipped : 0;

        window.alert(
          "Outlook sync complete.\n\n" +
          "Matched customer/reply conversations: " + matched + "\n" +
          "New reviews added: " + inserted + "\n" +
          "Existing reviews skipped: " + skipped
        );

        refreshButton.click();
      } catch (error) {
        window.alert(error.message || "Outlook sync failed.");
      } finally {
        syncButton.disabled = false;
        syncButton.textContent = originalText;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addSyncButton);
  } else {
    addSyncButton();
  }
})();
