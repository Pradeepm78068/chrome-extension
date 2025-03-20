// API Key (for now, replace with secure storage in production)
const API_KEY = "AIzaSyAFy1PE-NhZsIslFeRTvQwPN1XcjdQdAF8"; 

async function fetchAIResponse(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const requestData = {
        contents: [
            {
                parts: [
                    {
                        text: promptText
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
        }
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Error:", errorData);
            return `API Error: ${errorData.error.message}`;
        }

        const data = await response.json();
        console.log("AI Response:", data);

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.warn("No valid candidates in API response:", data);
            return "AI could not generate a response.";
        }
    } catch (error) {
        console.error("Error fetching AI response:", error);
        return "Error fetching AI response: " + error.message;
    }
}

function formatAIResponse(rawResponse) {
    const cleanedResponse = rawResponse.replace(/\*\*/g, '');
    const lines = cleanedResponse.split('\n').filter(line => line.trim());
    let formatted = '';
    let inList = false;
    let optionCounter = 1;

    lines.forEach((line, index) => {
        if (!inList && !line.match(/^Option \d+/)) {
            formatted += `${line}<br><br>`;
            return;
        }

        if (line.match(/^Option \d+ \(.+\):/)) {
            if (inList) formatted += '<br>';
            inList = true;
            const optionDesc = line.match(/\((.+)\)/)[1];
            formatted += `${optionCounter++}. ${optionDesc}:<br>`;
        }
        else if (inList && line.match(/^\s*Note Title:/)) {
            const content = line.replace('Note Title:', '').trim();
            formatted += `  <b>Note Title:</b> ${content}<br>`;
        }
        else if (inList && line.match(/^\s*Note Content:/)) {
            const content = line.replace('Note Content:', '').trim();
            formatted += `  <b>Note Content:</b> ${content}`;
        }
        else if (inList && line.trim() && !line.match(/^Option \d+/)) {
            formatted += ` ${line.trim()}`;
        }
    });

    return formatted || cleanedResponse.replace(/\n/g, '<br>');
}

function saveNote() {
    const noteInput = document.getElementById("noteInput");
    const noteText = noteInput.innerHTML.trim();

    if (noteText && noteText !== '<br>') {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentUrl = tabs[0].url;
            const currentTitle = tabs[0].title;
            let notes = JSON.parse(localStorage.getItem("notes")) || [];
            notes.push({ text: noteText, url: currentUrl, urlname: currentTitle });
            localStorage.setItem("notes", JSON.stringify(notes));
            displayNotes();
            noteInput.innerHTML = '';
            noteInput.setAttribute('data-placeholder', "Note saved! Type another...");
            setTimeout(() => noteInput.setAttribute('data-placeholder', "Type your note..."), 2000);
        });
    }
}

function displayNotes() {
    const noteList = document.getElementById("noteList");
    const notes = JSON.parse(localStorage.getItem("notes")) || [];
    noteList.innerHTML = '';
    
    notes.slice().reverse().forEach((note, index) => {
        const li = document.createElement("li");
        
        const noteText = document.createElement("p");
        noteText.innerHTML = note.text;
        
        const noteUrl = document.createElement("small");
        noteUrl.innerHTML = `<a href="${note.url}" target="_blank">${note.urlname}</a>`;
        
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = `<img src="assets/delete.png" alt="Delete" style="width: 20px; height: 20px;">`;
        deleteBtn.classList.add("delete-btn");
        deleteBtn.addEventListener("click", () => deleteNote(notes.length - 1 - index));

        li.appendChild(noteUrl);
        li.appendChild(noteText);
        li.appendChild(deleteBtn);

        noteList.appendChild(li);
    });
}

function deleteNote(index) {
    let notes = JSON.parse(localStorage.getItem("notes")) || [];
    notes.splice(index, 1);
    localStorage.setItem("notes", JSON.stringify(notes));
    displayNotes();
}

document.addEventListener("DOMContentLoaded", function () {
    const quickNotesBtn = document.getElementById("quickNotesBtn");
    const previousNotesBtn = document.getElementById("previousNotesBtn");
    const quickNotesSection = document.getElementById("quickNotesSection");
    const previousNotesSection = document.getElementById("previousNotesSection");
    const aiSuggestBtn = document.getElementById("aiSuggestBtn");
    const noteInput = document.getElementById("noteInput");
    const saveBtn = document.getElementById("saveBtn");

    if (!aiSuggestBtn || !noteInput || !saveBtn) {
        console.error("Required elements not found.");
        return;
    }

    function showQuickNotes() {
        quickNotesSection.style.display = "block";
        previousNotesSection.style.display = "none";
        quickNotesBtn.classList.add("active");
        previousNotesBtn.classList.remove("active");
    }

    function showPreviousNotes() {
        quickNotesSection.style.display = "none";
        previousNotesSection.style.display = "block";
        quickNotesBtn.classList.remove("active");
        previousNotesBtn.classList.add("active");
    }

    quickNotesBtn.addEventListener("click", showQuickNotes);
    previousNotesBtn.addEventListener("click", showPreviousNotes);
    saveBtn.addEventListener("click", saveNote);

    aiSuggestBtn.addEventListener("click", async function () {
        console.log("AI Suggestion button clicked.");
        aiSuggestBtn.textContent = "Loading...";
        aiSuggestBtn.classList.add("loading"); // Add loading class to button
        noteInput.classList.add("loading-glow"); // Add glow effect to noteInput
    
        const userNote = noteInput.innerHTML.trim();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                console.error("No active tab found.");
                aiSuggestBtn.textContent = "Get AI Suggestion";
                aiSuggestBtn.classList.remove("loading"); // Remove loading class from button
                noteInput.classList.remove("loading-glow"); // Remove glow effect
                noteInput.innerHTML = "Error: Could not access the current tab.";
                return;
            }
    
            chrome.tabs.sendMessage(tabs[0].id, { action: "getPageInfo" }, async (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error getting page info:", chrome.runtime.lastError.message);
                    response = { title: "Unknown", url: "Unknown", selectedText: "None" };
                }
                console.log("Page info:", response);
    
                const isContextEmpty = response.title === "Unknown" && response.url === "Unknown" && response.selectedText === "None";
                let prompt;
    
                if (userNote) {
                    if (isContextEmpty) {
                        prompt = `Enhance the following note by improving its clarity, adding relevant details, or rephrasing it for better understanding:\n- User's Note: ${userNote}\nNote: No page context is available, so provide a general enhancement.`;
                    } else {
                        prompt = `Enhance the following note by improving its clarity, adding relevant details, or rephrasing it for better understanding. Use the page context to add relevant information if applicable:\n- User's Note: ${userNote}\n- Page Context:\n  - Page Title: ${response.title}\n  - URL: ${response.url}\n  - Selected Text: ${response.selectedText}`;
                    }
                } else {
                    if (isContextEmpty) {
                        prompt = `Suggest a general note idea for taking notes on a web page, since no specific page context is available.`;
                    } else {
                        prompt = `Suggest a note idea based on the following page context:\n- Page Title: ${response.title}\n- URL: ${response.url}\n- Selected Text: ${response.selectedText}`;
                    }
                }
                console.log("Prompt:", prompt);
    
                const aiSuggestion = await fetchAIResponse(prompt);
                console.log("Raw AI suggestion:", aiSuggestion);
    
                const formattedSuggestion = formatAIResponse(aiSuggestion);
                console.log("Formatted suggestion:", formattedSuggestion);
    
                aiSuggestBtn.textContent = "Get AI Suggestion";
                aiSuggestBtn.classList.remove("loading"); // Remove loading class from button
                noteInput.classList.remove("loading-glow"); // Remove glow effect
                noteInput.innerHTML = formattedSuggestion;
            });
        });
    });

    showQuickNotes();
    displayNotes();
});