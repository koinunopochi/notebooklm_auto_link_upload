const csvFileInput = document.getElementById('csvFileInput');
const fileInfoDiv = document.getElementById('fileInfo');
const columnNameInput = document.getElementById('columnNameInput');
const startCsvButton = document.getElementById('startButton');
const urlListTextArea = document.getElementById('urlList');
const startTextHtmlButton = document.getElementById('startTextHtmlButton');
const statusDiv = document.getElementById('status');
const stopButton = document.getElementById('stopButton'); // Assuming you might add stop functionality later

function disableUI() {
    startCsvButton.disabled = true;
    startTextHtmlButton.disabled = true;
    if (csvFileInput) csvFileInput.disabled = true;
    if (columnNameInput) columnNameInput.disabled = true;
    if (urlListTextArea) urlListTextArea.disabled = true;
    // if (stopButton) stopButton.style.display = 'block'; // Show stop button if needed
}
function enableUI() {
    startCsvButton.disabled = false;
    startTextHtmlButton.disabled = false;
    if (csvFileInput) csvFileInput.disabled = false;
    if (columnNameInput) columnNameInput.disabled = false;
    if (urlListTextArea) urlListTextArea.disabled = false;
    // if (stopButton) stopButton.style.display = 'none'; // Hide stop button
}

if (csvFileInput) {
    csvFileInput.addEventListener('change', (event) => {
        try {
            if (!fileInfoDiv || !statusDiv) {
                alert("Popup Error: Missing required HTML elements (fileInfoDiv or statusDiv).");
                return;
            }

            if (event.target && event.target.files && event.target.files.length > 0) {
                const file = event.target.files[0];
                fileInfoDiv.textContent = `Selected: ${file.name}`;
                statusDiv.textContent = '';
                statusDiv.className = '';

                // 設定を読み込む
                chrome.storage.local.get(['columnName'], function(result) {
                    const columnName = result.columnName || 'URL';
                    columnNameInput.value = columnName;
                });

                chrome.runtime.sendMessage({ type: 'FILE_SELECTED_PING', fileName: file.name }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Optional: Handle ping error silently or display a non-critical warning
                    }
                });

            } else {
                fileInfoDiv.textContent = 'No file selected.';
            }
        } catch (error) {
            if (statusDiv) {
                statusDiv.textContent = `Error on file select: ${error.message}`;
                statusDiv.className = 'error';
            } else {
                alert(`Error on file select: ${error.message}`);
            }
        }
    });
} else {
     // Maybe alert user or log to background if critical element missing on load
     console.error("[Popup] CRITICAL ERROR: csvFileInput element not found in popup.html!");
}


if (startCsvButton) {
    startCsvButton.addEventListener('click', () => {
        if (!csvFileInput || !columnNameInput || !statusDiv || !fileInfoDiv) {
             alert("Popup Error: Required elements missing for CSV processing.");
             return;
        }

        if (csvFileInput.files.length === 0) {
            statusDiv.textContent = 'Please select a CSV file first.';
            statusDiv.className = 'error';
            return;
        }

        const file = csvFileInput.files[0];
        const columnName = columnNameInput.value.trim() || 'URL';

        statusDiv.textContent = `Reading CSV file... Column: "${columnName}"`;
        statusDiv.className = '';
        disableUI();

        const reader = new FileReader();

        reader.onload = function(event) {
            const csvData = event.target.result;

            if (typeof Papa === 'undefined') {
                statusDiv.textContent = 'Error: CSV Parsing library not loaded.';
                statusDiv.className = 'error';
                enableUI();
                return;
            }

            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        statusDiv.textContent = `Error parsing CSV: ${results.errors[0].message}`;
                        statusDiv.className = 'error';
                        enableUI();
                        return;
                    }

                     if (!results.meta || !results.meta.fields) {
                         statusDiv.textContent = 'Error parsing CSV: Header row not detected.';
                         statusDiv.className = 'error';
                         enableUI();
                         return;
                     }

                    if (!results.meta.fields.includes(columnName)) {
                        const availableColumns = results.meta.fields.join(', ');
                        statusDiv.textContent = `Error: Column "${columnName}" not found. Available: ${availableColumns}`;
                        statusDiv.className = 'error';
                        enableUI();
                        return;
                    }

                    let urls = results.data
                        .map(row => row[columnName])
                        .filter(url => url && typeof url === 'string' && url.trim() !== '' && !url.startsWith('#'))
                        .map(url => url.trim());
                    urls = [...new Set(urls)];

                    if (urls.length === 0) {
                         statusDiv.textContent = `No valid URLs found in column "${columnName}".`;
                         statusDiv.className = 'error';
                         enableUI();
                         return;
                    }

                    statusDiv.textContent = `Found ${urls.length} URLs from CSV. Sending...`;
                    chrome.runtime.sendMessage(
                        { type: 'PROCESS_URL_LIST', urls: urls },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                 statusDiv.textContent = `Error sending data: ${chrome.runtime.lastError.message}`;
                                 statusDiv.className = 'error';
                                 enableUI();
                            }
                        }
                     );
                },
                error: function(error, file) {
                     statusDiv.textContent = `CSV parsing failed: ${error.message}`;
                     statusDiv.className = 'error';
                     enableUI();
                }
            });
        };

        reader.onerror = function(event) {
             statusDiv.textContent = 'Error reading the selected file.';
             statusDiv.className = 'error';
             enableUI();
        };

        try {
            reader.readAsText(file);
        } catch (readError) {
             statusDiv.textContent = `Error initiating file read: ${readError.message}`;
             statusDiv.className = 'error';
             enableUI();
        }
    });
}


if (startTextHtmlButton) {
    startTextHtmlButton.addEventListener('click', () => {
        if (!urlListTextArea || !statusDiv) {
             alert("Popup Error: Required elements missing for Text/HTML processing.");
             return;
        }
        const inputText = urlListTextArea.value.trim();
        if (!inputText) {
             statusDiv.textContent = 'Please paste URLs or HTML first.';
             statusDiv.className = 'error';
             return;
        }

        statusDiv.textContent = 'Processing pasted text/HTML...';
        statusDiv.className = '';
        disableUI();

        let urls = [];
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = inputText;
            const anchors = tempDiv.querySelectorAll('a');
            if (anchors.length > 0 && inputText.toLowerCase().includes('<a')) {
                 anchors.forEach(anchor => {
                     const href = anchor.getAttribute('href');
                     if (href && href.trim() !== '' && !href.startsWith('#') && !href.startsWith('javascript:')) {
                         try {
                             urls.push(new URL(href.trim(), window.location.href).href);
                         } catch (e) {
                             // Ignore invalid URLs
                         }
                     }
                 });
                 urls = [...new Set(urls)];
            }
        } catch (e) { /* Ignore potential HTML parsing errors */ }

        if (urls.length === 0) {
            urls = inputText
                .split(/[\s,;\t\n]+/)
                .map(url => url.trim())
                .filter(url => url && url.length > 3 && url.includes('.') && !url.startsWith('#')); // Basic URL check
            urls = urls.map(url => { // Add protocol if missing
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    return 'https://' + url;
                }
                return url;
            });
             urls = [...new Set(urls)]; // Remove duplicates again
             urls = urls.filter(url => { // Final validation attempt
                  try {
                       new URL(url);
                       return true;
                  } catch (e) { return false; }
             });
        }

        if (urls.length === 0) {
             statusDiv.textContent = `No valid URLs found in the pasted content.`;
             statusDiv.className = 'error';
             enableUI();
             return;
        }

        statusDiv.textContent = `Found ${urls.length} URLs from text/HTML. Sending...`;
         chrome.runtime.sendMessage(
             { type: 'PROCESS_URL_LIST', urls: urls },
             (response) => {
                  if (chrome.runtime.lastError) {
                       statusDiv.textContent = `Error sending data: ${chrome.runtime.lastError.message}`;
                       statusDiv.className = 'error';
                       enableUI();
                  }
             }
         );
    });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_STATUS') {
    if (statusDiv) statusDiv.textContent = message.text;
    if (statusDiv) statusDiv.className = message.isError ? 'error' : '';
  } else if (message.type === 'PROCESS_COMPLETE') {
    if (statusDiv) statusDiv.textContent = message.text;
    if (statusDiv) {
        if (message.text && (message.text.toLowerCase().includes('failed') || message.text.toLowerCase().includes('error'))) {
             statusDiv.className = 'error';
        } else {
             statusDiv.className = 'success';
        }
    }
    enableUI();
  }
});


document.addEventListener('DOMContentLoaded', () => {
    if (csvFileInput) csvFileInput.value = '';
    if (fileInfoDiv) fileInfoDiv.textContent = 'No file selected.';
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }
    if (urlListTextArea) urlListTextArea.focus();
    enableUI(); // Ensure UI is enabled on load
});

// 設定画面を開くボタンを追加
const openOptionsButton = document.createElement('button');
openOptionsButton.textContent = '設定を開く';
openOptionsButton.style.marginTop = '10px';
openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});
document.body.appendChild(openOptionsButton);
