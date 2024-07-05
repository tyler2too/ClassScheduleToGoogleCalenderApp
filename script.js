let CLIENT_ID = '972247015927-uocb4ika9mn940knj91qk6e7r1edsc3i.apps.googleusercontent.com';
let API_KEY = 'AIzaSyAAIFD7oJZMGXdAH84VeYcFFs1MtAqpoD0';
let SCOPES = "https://www.googleapis.com/auth/calendar.events";

function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        scope: SCOPES
    }).then(function () {
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    }, function(error) {
        console.error('Error during client initialization', error);
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        document.getElementById('authButton').style.display = 'none';
        document.getElementById('signoutButton').style.display = 'block';
        addEventsToCalendar();
    } else {
        document.getElementById('authButton').style.display = 'block';
        document.getElementById('signoutButton').style.display = 'none';
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn().then(function() {
        console.log('User signed in');
    }, function(error) {
        console.error('Error during sign in', error);
    });
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut().then(function() {
        console.log('User signed out');
    }, function(error) {
        console.error('Error during sign out', error);
    });
}

function addEventsToCalendar() {
    const events = JSON.parse(document.getElementById('output').innerText);
    events.forEach(event => {
        console.log('Adding event:', event); // Log event before adding
        gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event
        }).then(function(response) {
            console.log('Event created: ' + response.htmlLink);
        }, function(error) {
            console.error('Error creating event', error);
        });
    });
}

document.addEventListener("DOMContentLoaded", handleClientLoad);

function parseSchedule() {
    const scheduleInput = document.getElementById('scheduleInput').value;
    const lines = scheduleInput.split('\n').filter(line => line.trim() !== '');
    const events = [];

    for (let i = 0; i < lines.length; i += 7) {
        const classInfo = lines[i].split('\t');
        const timeInfo = lines[i + 3].split(' - ');
        const days = lines[i + 4].trim();
        const location = lines[i + 5].trim();
        const instructor = lines[i + 6].trim();

        if (timeInfo.length === 2 && days !== 'ARRANGED') {
            const [startTime, endTime] = timeInfo;
            const [startHours, startMinutes] = convertTo24Hour(startTime);
            const [endHours, endMinutes] = convertTo24Hour(endTime);
            const startDate = new Date();
            startDate.setHours(startHours, startMinutes, 0, 0);
            const endDate = new Date();
            endDate.setHours(endHours, endMinutes, 0, 0);

            days.split('').forEach(day => {
                const event = {
                    summary: `${classInfo[0].trim()} ${classInfo[2].trim()}`,
                    location: location,
                    start: {
                        dateTime: getNextDayOfWeek(startDate, day).toISOString()
                    },
                    end: {
                        dateTime: getNextDayOfWeek(endDate, day).toISOString()
                    },
                    description: instructor
                };
                events.push(event);
            });
        }
    }

    document.getElementById('output').innerText = JSON.stringify(events, null, 2);
    document.getElementById('authButton').style.display = 'block';
}

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
