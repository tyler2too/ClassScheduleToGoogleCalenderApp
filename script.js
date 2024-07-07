/////////////////////////
//
// Class Schedule To Google Calendar
// Used Google Calendar API and OAuth2.0 authentication (Connect to google account)
//
/////////////////////////
//
// Tyler Too
// July 2024
// Inspiration/Motivation -> No internship -> Personal Project
// Any recruiter reading this please hire me
// tyler.hzt@gmail.com
//
/////////////////////////


const CLIENT_ID = '972247015927-uocb4ika9mn940knj91qk6e7r1edsc3i.apps.googleusercontent.com';
const API_KEY = 'AIzaSyD8eZ_7kBv8Ge--q9UkqQuWt5C29nOxty4'; // Please dont hack me (It's restricted through google)
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let tokenClient;            // OAuth 2.0 token (user authentication)
let gapiInited = false;     // Check for Google API library initialization
let gisInited = false;      // Check for Google Identity services library initialization


function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}


async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButton();
}


function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButton();
}


function maybeEnableButton() {
    if (gapiInited && gisInited) {
        document.getElementById('submitButton').style.display = 'block';
    }
}


//
// Submit and Authorization button
//
async function handleAuthAndSubmitClick() {
    const events = parseSchedule(); // Parse the schedule and prepare the events/classes

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        await addEventsToCalendar(events); // Add events to the calendar after authorization
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

//
// Show success or error message
//
function showMessage(type, message) {
    const outputElement = document.getElementById('output');
    const messageElement = document.createElement('div');
    messageElement.classList.add(type === 'error' ? 'error-message' : 'success-message');
    messageElement.textContent = message;
    outputElement.appendChild(messageElement);
}


function toggleHint() {
    const hintText = document.getElementById('hintText');
    if (hintText.style.display === 'none') {
        hintText.style.display = 'block';
    } else {
        hintText.style.display = 'none';
    }
}


function formatDateTime(date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);

    const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

    return formattedDateTime;
}


//
// Time needs to be in military time format
//
function convertTo24Hour(time) {
    const [hours, minutesPart] = time.split(':');
    const minutes = minutesPart.substring(0, 2);
    const period = minutesPart.substring(2).trim().toUpperCase();
    let hours24 = parseInt(hours, 10);
    if (period === 'PM' && hours24 < 12) hours24 += 12;
    if (period === 'AM' && hours24 === 12) hours24 = 0;
    return [hours24, parseInt(minutes, 10)];
}


function getNextDayOfWeek(date, day) {
    const dayMap = { 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6, 'U': 0 };
    const resultDate = new Date(date);
    resultDate.setDate(date.getDate() + (dayMap[day] + 7 - date.getDay()) % 7);
    return resultDate;
}


//
// Main script for getting the Class Schedule to Google Cal
//
function parseSchedule() {
    const startDateInput = document.getElementById('startDateInput').value;
    const endDateInput = document.getElementById('endDateInput').value;
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    const scheduleInput = document.getElementById('scheduleInput').value;
    const lines = scheduleInput.split('\n').filter(line => line.trim() !== '');
    const events = [];

    const startDayOfWeek = startDate.getDay();

    for (let i = 0; i < lines.length; i += 7) {
        // Ensure at least 7 lines are available
        if (i + 7 > lines.length) {
            console.error(`Incomplete data at line ${i}. Expected at least 7 lines.`);
            continue;
        }

        let classInfo = lines[i].split(/\s{2,}/); // Split by two or more spaces

        // If split by multiple spaces yields insufficient info, try splitting by tab
        if (!classInfo || classInfo.length < 2) {
            classInfo = lines[i].split('\t'); // Split by tab if necessary
        }

        // Check if classInfo has enough elements
        if (!classInfo || classInfo.length < 2) {
            console.error(`Incomplete class info at line ${i}. Skipping event creation. Class Info: `, classInfo);
            continue;
        }

        // Ensure that timeInfo, days, location, and instructorLine are defined and not empty
        const timeInfoLine = lines[i + 3];
        const daysLine = lines[i + 4];
        const locationLine = lines[i + 5];
        let instructorLine = lines[i + 6];

        // Check if instructorLine is correctly assigned
        if (!instructorLine.includes(',')) {
            // If instructorLine doesn't contain a comma, treat it as part of the next classInfo
            //classInfo.push(instructorLine); // Add instructorLine to classInfo
            instructorLine = 'N/A'; // Set instructorLine to 'N/A' for current event
            i--;
        }

        if (!timeInfoLine || !daysLine || !locationLine || !instructorLine) {
            console.error(`Missing data at line ${i}. Skipping event creation.`);
            continue;
        }

        const summary = `${classInfo[0].trim()}`;
        const timeInfo = timeInfoLine.split(' - ');
        const days = daysLine.trim();
        const location = locationLine.trim();
        let instructor = instructorLine.trim();

        // Handle cases where instructor is missing or incorrectly formatted
        if (!instructor || instructor === 'n.a') {
            instructor = 'N/A';
        }

        // Log classInfo and other relevant details for debugging
        console.log(`Class Info at line ${i}: `, classInfo);
        console.log(`Time Info at line ${i}: `, timeInfoLine);
        console.log(`Days at line ${i}: `, daysLine);
        console.log(`Location at line ${i}: `, locationLine);
        console.log(`Instructor at line ${i}: `, instructorLine);

        if (timeInfo.length === 2 && days !== 'ARRANGED') {
            const [startTime, endTime] = timeInfo;
            const [startHours, startMinutes] = convertTo24Hour(startTime);
            const [endHours, endMinutes] = convertTo24Hour(endTime);

            let startDateInstance;
            if (days.includes('M') && startDayOfWeek === 1) {
                startDateInstance = new Date(startDate);
            } else {
                startDateInstance = getNextDayOfWeek(startDate, days.charAt(0));
            }
            startDateInstance.setHours(startHours, startMinutes, 0, 0);

            const endDateInstance = new Date(startDateInstance);
            endDateInstance.setHours(endHours, endMinutes, 0, 0);

            const recurrenceDays = days !== 'N/A' && days !== '.' && days !== 'A' ?
                days.split('').map(day => {
                    switch (day.toUpperCase()) {
                        case 'M': return 'MO';
                        case 'T': return 'TU';
                        case 'W': return 'WE';
                        case 'R': return 'TH';
                        case 'F': return 'FR';
                        case 'S': return 'SA';
                        case 'U': return 'SU';
                        default: return '';
                    }
                }).filter(day => day !== '').join(',') : '';

            const untilDate = endDate.toISOString().slice(0, 10).replace(/-/g, '');

            const recurrenceRule = `RRULE:FREQ=WEEKLY;UNTIL=${untilDate};BYDAY=${recurrenceDays};WKST=SU;INTERVAL=1;BYHOUR=${startHours};BYMINUTE=${startMinutes}`;

            // Create events with proper summary, location, start time, end time, etc.
            const event = {
                summary: summary,
                location: location,
                start: {
                    dateTime: formatDateTime(startDateInstance),
                    timeZone: 'America/Chicago'
                },
                end: {
                    dateTime: formatDateTime(endDateInstance),
                    timeZone: 'America/Chicago'
                },
                description: instructor,
                recurrence: [
                    recurrenceRule
                ]
            };

            // Log event details when event is successfully created
            console.log(`Event created for class info at line ${i}: `, event);

            events.push(event);
        }
    }

    return events;
}








//
// Adds color to event/classes in Google Calendar & outputs success or error message
//
async function addEventsToCalendar(events) {
    const colorIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']; // Only 11 color options
    let colorIndex = 0;

    try {
        for (const event of events) {
            event.colorId = colorIds[colorIndex % colorIds.length];

            const response = await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event,
            });

            console.log('Event created: ', response);
            if (response.result) {
                console.log('Event created: ' + response.result.htmlLink);
                showMessage('success', 'Events added successfully!');
            } else {
                console.error('Event creation failed: ', response);
                showMessage('error', 'Event creation failed. Please try again.');
            }

            colorIndex++;
        }
    } catch (error) {
        console.error('Error creating event', error);
        showMessage('error', 'An error occurred while adding events. Please try again.');
        if (error.result) {
            console.error('Detailed error:', error.result.error);
        }
    }
}


//
// HTML to JS link
//
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('submitButton').onclick = handleAuthAndSubmitClick;
    document.getElementById('hintButton').onclick = toggleHint;
    gapiLoaded();
    gisLoaded();
});