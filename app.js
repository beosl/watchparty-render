// app.js - Tek Dosyada Watchparty Uygulamas (WebRTC Eklendi)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const activeRooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}


// --- 1. HTML ve CSS/JS çerii (WebRTC Butonlar Eklendi) ---

const HLS_JS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
const SOCKET_IO_CLIENT_CDN = '/socket.io/socket.io.js'; 

const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Watchparty MVP</title>
    <script src="${SOCKET_IO_CLIENT_CDN}"></script>
    <script src="${HLS_JS_CDN}"></script>
    <style>
        /* Profesyonel Koyu Tema ve effaflk CSS */
        :root {
            --bg-color: #1a1a1a;
            --card-bg: #2c2c2c;
            --text-color: #f0f0f0;
            --primary-color: #007bff;
            --danger-color: #dc3545;
            --border-color: #444;
            --scrollbar-thumb: #666;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 0;
            padding: 20px;
        }

        h1 {
            color: var(--primary-color);
            margin-bottom: 30px;
            font-weight: 300;
            letter-spacing: 1px;
        }

        #join-screen {
            background-color: var(--card-bg);
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            max-width: 450px;
            width: 100%;
            text-align: center;
        }

        #join-screen h3 {
            color: var(--text-color);
            margin-top: 25px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
            margin-bottom: 15px;
        }

        input[type="text"], input[type="url"] {
            width: calc(100% - 20px);
            padding: 12px 10px;
            margin: 8px 0 15px 0;
            display: inline-block;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            box-sizing: border-box;
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: border-color 0.3s;
        }
        input[type="text"]:focus, input[type="url"]:focus {
            border-color: var(--primary-color);
            outline: none;
        }

        button {
            background-color: var(--primary-color);
            color: white;
            padding: 12px 20px;
            margin: 8px 5px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s, transform 0.1s;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:active {
            transform: scale(0.98);
        }
        
        #room-screen {
            display: none;
            width: 90%;
            max-width: 1400px;
            margin-top: 20px;
        }
        
        #room-main {
            width: 100%;
        }

        #video-panel {
            width: 100%; 
            position: relative; 
        }

        #player {
            width: 100%;
            height: auto;
            min-height: 400px; 
            max-height: 700px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        }

        /* WEB RTC KONTROLLER */
        #rtc-controls {
            display: flex;
            justify-content: center;
            gap: 20px;
            padding: 15px 0;
        }
        #mic-button {
            background-color: var(--danger-color); /* Balangçta Krmz (Kapal) */
            padding: 15px 25px;
        }
        #mic-button.active {
            background-color: #28a745; /* Aktifken Yeil */
        }
        .mic-icon {
            margin-right: 10px;
        }

        /* EFFAF SOHBET PANEL */
        #chat-panel {
            position: absolute; 
            top: 20px;
            right: 20px;
            width: 300px; 
            background-color: rgba(44, 44, 44, 0.7); 
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            padding: 15px;
            z-index: 10; 
            transition: background-color 0.3s;
        }
        
        #chat-panel:hover {
            background-color: var(--card-bg); 
        }

        /* Sohbet Alan */
        #chat-container {
            height: 300px; 
            overflow-y: auto;
            padding: 10px;
            background-color: rgba(26, 26, 26, 0.6); 
            border-radius: 4px;
            margin-bottom: 10px;
            border: 1px solid var(--border-color);
        }
        
        .chat-message {
            margin-bottom: 8px;
            line-height: 1.4;
        }
        .system-message { 
            color: #90ee90;
            font-style: italic; 
        }
        
        /* Sohbet Gönderme Alan */
        #message-input-wrapper {
            display: flex;
            gap: 10px;
        }
        #message-input {
            flex-grow: 1;
            width: auto !important;
            margin: 0 !important;
        }

        /* REMOTE AUDIO STATUS - Sadece debug/gösterim amaçl */
        #audio-streams {
            margin-top: 10px;
            font-size: 0.9em;
            color: #999;
        }

        /* Responsiveness: Küçük ekranlarda mutlak konumlandrmay kaldr */
        @media (max-width: 900px) {
            #chat-panel {
                position: static; 
                width: 100%;
                margin-top: 20px;
                background-color: var(--card-bg); 
            }
        }
    </style>
</head>
<body>

    <h1>SENKRON WATCHPARTY</h1>
    <hr style="width: 80%; border-color: var(--border-color);">

    <div id="join-screen">
        <h2>Watchparty'ye Giri</h2>
        
        <input type="text" id="username-input" placeholder="Kullanc Adnz Seçin" required><br>

        <h3>Oda Olutur</h3>
        <input type="url" id="content-url-input" placeholder="M3U8 veya MP4 Linki Yaptrn" required><br>
        <button onclick="createRoom()"> Yeni Oda Kur</button>

        <hr style="border-color: #383838; margin: 25px 0;">

        <h3>Odaya Katl</h3>
        <input type="text" id="room-id-input" placeholder="5 Haneli Oda Numaras" required><br>
        <button onclick="joinRoom()"> Odaya Gir</button>
    </div>

    <div id="room-screen">
        <h2 id="room-info" style="font-size: 1.5em; color: #aaa; margin-bottom: 20px;"></h2>
        
        <div id="room-main">
            <div id="video-panel">
                <video id="player" controls></video>
                
                <div id="rtc-controls">
                    <button id="mic-button" onclick="toggleMic()">
                        <span class="mic-icon"></span> Mikrofon Kapal
                    </button>
                    <div id="audio-streams"></div>
                </div>

                <div id="chat-panel">
                    <h3 style="margin-top: 0;">Canl Sohbet</h3>
                    <div id="chat-container">
                        </div>
                    
                    <div id="message-input-wrapper">
                        <input type="text" id="message-input" placeholder="Mesajnz yazn..." style="width: 80%;">
                        <button onclick="sendMessage()" style="padding: 10px 15px; margin: 0;">Gönder</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // CLIENT-SIDE JAVASCRIPT MANTIK KODU
        const socket = io();
        let currentRoomId = null;
        let currentUsername = '';
        const player = document.getElementById('player');
        let hls = null; 
        let isSyncing = false; 

        // WebRTC Deikenleri
        let localStream = null;
        const peerConnections = {}; // Key: socket.id, Value: RTCPeerConnection
        const STUN_SERVERS = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
            ]
        };

        // --- ROOM/SETUP MANTIKLARI ---
        function createRoom() {
            currentUsername = document.getElementById('username-input').value.trim();
            const contentUrl = document.getElementById('content-url-input').value.trim();
            if (!currentUsername || !contentUrl) { alert("Lütfen kullanc ad ve geçerli bir link girin."); return; }

            socket.emit('createRoom', { username: currentUsername, contentUrl: contentUrl }, (response) => {
                if (response.success) {
                    currentRoomId = response.roomId;
                    setupRoom(response.contentUrl, null);
                } else {
                    alert('Oda oluturulurken bir hata olutu: ' + response.message);
                }
            });
        }

        function joinRoom() {
            currentUsername = document.getElementById('username-input').value.trim();
            const roomId = document.getElementById('room-id-input').value.trim();
            if (!currentUsername || !roomId) { alert("Lütfen kullanc ad ve oda numarasn girin."); return; }

            socket.emit('joinRoom', { roomId: roomId, username: currentUsername }, (response) => {
                if (response.success) {
                    currentRoomId = roomId;
                    setupRoom(response.contentUrl, response.playerState);
                } else {
                    alert('Odaya katlrken bir hata olutu: ' + response.message);
                }
            });
        }

        function setupRoom(url, state) {
            document.getElementById('join-screen').style.display = 'none';
            document.getElementById('room-screen').style.display = 'block';
            document.getElementById('room-info').innerText = \`Oda Numaras: \${currentRoomId} | Kullanc Adnz: \${currentUsername}\`;

            loadVideoSource(url);
            
            if (state) {
                isSyncing = true;
                player.currentTime = state.time;
                if (!state.paused) {
                    player.play().catch(e => console.error("Oynatma baarsz: ", e)); 
                } else {
                    player.pause();
                }
                isSyncing = false;
            }

            setupPlayerListeners();
            // Odaya girer girmez WebRTC balantlarn balat
            socket.emit('ready', currentRoomId); 
        }

        // --- VDEO SYNC MANTIKLARI (Deimedi) ---
        // ... (loadVideoSource ve setupPlayerListeners kodlar yerinde kalmal) ...

        function loadVideoSource(url) {
            if (url.includes('.m3u8')) {
                if (Hls.isSupported()) {
                    if (hls) hls.destroy(); 
                    hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(player);
                } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
                    player.src = url;
                } else {
                    alert('Taraycnz M3U8 (HLS) akn desteklemiyor.');
                }
            } else {
                player.src = url;
            }
        }

        function setupPlayerListeners() {
            player.onplay = () => {
                if (!isSyncing && currentRoomId) {
                    socket.emit('playerAction', { roomId: currentRoomId, action: 'play', time: player.currentTime });
                }
            };

            player.onpause = () => {
                if (!isSyncing && currentRoomId) {
                    socket.emit('playerAction', { roomId: currentRoomId, action: 'pause', time: player.currentTime });
                }
            };

            player.onseeked = () => {
                if (!isSyncing && currentRoomId) {
                    socket.emit('playerAction', { roomId: currentRoomId, action: 'seek', time: player.currentTime });
                }
            };
        }

        socket.on('syncAction', (data) => {
            if (!currentRoomId) return;

            isSyncing = true;
            if (data.action === 'seek') {
                player.currentTime = data.time;
            } else if (data.action === 'play') {
                player.currentTime = data.time;
                player.play().catch(e => console.error("Oynatma baarsz (Sync): ", e));
            } else if (data.action === 'pause') {
                player.currentTime = data.time;
                player.pause();
            }
            setTimeout(() => isSyncing = false, 500);
        });

        // --- CHAT MANTIKLARI (effaf sohbet için HTML/CSS güncellendi) ---
        socket.on('chatMessage', (data) => {
            const chatBox = document.getElementById('chat-container');
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message');
            
            let messageText = '';
            if (data.user === 'Sistem') {
                messageElement.innerHTML = \`<span class="system-message">\${data.user}: \${data.text}</span>\`;
            } else {
                messageElement.innerHTML = \`<strong>\${data.user}:</strong> \${data.text}\`;
            }

            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        function sendMessage() {
            const messageInput = document.getElementById('message-input');
            const message = messageInput.value.trim();

            if (message && currentRoomId) {
                socket.emit('sendMessage', { roomId: currentRoomId, username: currentUsername, message: message });
                messageInput.value = '';
            }
        }

        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // --- WEBRTC MANTIKLARI ---

        /**
         * Mikrofonu açp kapatr ve ak ayarlar.
         */
        async function toggleMic() {
            const micButton = document.getElementById('mic-button');

            if (localStream && localStream.getAudioTracks().length > 0) {
                // MKROFON KAPATILIYOR
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
                micButton.classList.remove('active');
                micButton.innerHTML = '<span class="mic-icon"></span> Mikrofon Kapal';
                
                // Balantlardan ak kaldr
                for (const peerId in peerConnections) {
                    const pc = peerConnections[peerId];
                    pc.getSenders().forEach(sender => {
                        if (sender.track && sender.track.kind === 'audio') {
                            pc.removeTrack(sender);
                        }
                    });
                }
                // Dierlerine bildirmek için 'mic-off' sinyali gönderilebilir (istee bal)
                return;
            }

            // MKROFON AÇILIYOR
            try {
                // Yalnzca ses (audio) akn iste
                localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

                micButton.classList.add('active');
                micButton.innerHTML = '<span class="mic-icon"></span> Mikrofon Açk';

                // Ak tüm mevcut PeerConnection'lara ekle ve sinyalizasyon balat
                for (const peerId in peerConnections) {
                    const pc = peerConnections[peerId];
                    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                    
                    // Offer göndererek yenilenmi ak balat
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('signal', { to: peerId, signal: pc.localDescription, roomId: currentRoomId });
                }

            } catch (err) {
                console.error("Mikrofon eriimi reddedildi: ", err);
                alert("Mikrofonunuzu kullanmak için izin vermelisiniz.");
                micButton.classList.remove('active');
                micButton.innerHTML = '<span class="mic-icon"></span> Mikrofon Kapal';
            }
        }

        /**
         * Yeni bir PeerConnection oluturur ve olay dinleyicilerini ayarlar.
         * @param {string} peerId - Balant kurulacak dier kullancnn socket ID'si
         */
        function createPeerConnection(peerId) {
            const pc = new RTCPeerConnection(STUN_SERVERS);
            
            // 1. ICE Adaylarn Topla
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('signal', { to: peerId, signal: event.candidate, roomId: currentRoomId });
                }
            };

            // 2. Uzaktan Gelen Ak Dinle
            pc.ontrack = (event) => {
                const stream = event.streams[0];
                addRemoteAudio(peerId, stream);
            };

            // 3. Yerel Ak Balantya Ekle (Varsa)
            if (localStream) {
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            }
            
            peerConnections[peerId] = pc;
            return pc;
        }

        /**
         * Bakalarnn sesini oynatmak için görünmez <audio> elementi oluturur.
         */
        function addRemoteAudio(peerId, stream) {
            let audioEl = document.getElementById('audio-' + peerId);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'audio-' + peerId;
                audioEl.autoplay = true;
                audioEl.style.display = 'none'; // Ses elementini gizle
                document.getElementById('audio-streams').appendChild(audioEl);
            }
            audioEl.srcObject = stream;
            
            // Sesin geldiini chat ekrannda belirt (istee bal)
            console.log(\`Remote ses ak \${peerId} için baland.\`);
        }

        // --- SOCKET.IO SINYALLEME OLAYLARI ---

        // Oda hazr olduunda, sunucu dier kullanclarn ID'lerini gönderir
        socket.on('userJoined', (peerId) => {
            const pc = createPeerConnection(peerId);
            
            // Yeni katlan kullancya offer gönder
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socket.emit('signal', { to: peerId, signal: pc.localDescription, roomId: currentRoomId });
                })
                .catch(err => console.error("Offer oluturma hatas:", err));
        });

        socket.on('userLeft', (peerId) => {
            if (peerConnections[peerId]) {
                peerConnections[peerId].close();
                delete peerConnections[peerId];
                
                // Ses elementini kaldr
                const audioEl = document.getElementById('audio-' + peerId);
                if (audioEl) {
                    audioEl.remove();
                }
            }
        });

        // Sinyalleme Mesajlarn le
        socket.on('signal', async (data) => {
            const { from, signal } = data;
            
            let pc = peerConnections[from];
            
            // Eer balant yoksa olutur
            if (!pc) {
                pc = createPeerConnection(from);
            }

            if (signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                
                // Cevap olutur (Answer)
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal', { to: from, signal: pc.localDescription, roomId: currentRoomId });

            } else if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));

            } else if (signal.type === 'candidate') {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal));
                } catch (e) {
                    console.error('ICE aday eklenemedi:', e);
                }
            }
        });

        // Oda kapatma
        socket.on('roomClosed', () => {
            alert("Oda kurucusu ayrld için bu oda kapatld.");
            
            // Tüm WebRTC balantlarn kapat
            for (const peerId in peerConnections) {
                peerConnections[peerId].close();
            }
            localStream && localStream.getTracks().forEach(track => track.stop());

            document.getElementById('room-screen').style.display = 'none';
            document.getElementById('join-screen').style.display = 'block';
            currentRoomId = null;
        });

    </script>
</body>
</html>
`;


// --- 2. Sunucu Yönlendirmeleri ve Socket.IO Mant (WebRTC Sinyallemesi Eklendi) ---

app.get('/', (req, res) => {
  res.send(FRONTEND_HTML);
});


io.on('connection', (socket) => {
    console.log(`Yeni kullanc baland: ${socket.id}`);

    // Kullancnn hangi odada olduunu bulmak için yardmc fonksiyon
    function getUserRoomId() {
        const rooms = Object.keys(activeRooms);
        for (const roomId of rooms) {
            if (activeRooms[roomId].members.hasOwnProperty(socket.id)) {
                return roomId;
            }
        }
        return null;
    }

    socket.on('createRoom', (data, callback) => {
        const roomId = generateRoomId();
        const { username, contentUrl } = data;

        activeRooms[roomId] = {
            ownerId: socket.id,
            contentUrl: contentUrl,
            playerState: { time: 0, paused: true },
            members: { [socket.id]: username } 
        };

        socket.join(roomId);
        callback({ success: true, roomId: roomId, contentUrl: contentUrl });
        io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} oday kurdu ve yayn balatt!` });
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomId, username } = data;
        const room = activeRooms[roomId];

        if (!room) {
            return callback({ success: false, message: 'Bu oda bulunamad veya kapatld.' });
        }
        
        if (Object.values(room.members).includes(username)) {
            return callback({ success: false, message: 'Bu kullanc ad zaten bu odada kullanlyor.' });
        }

        room.members[socket.id] = username;
        socket.join(roomId);
        
        callback({ success: true, contentUrl: room.contentUrl, playerState: room.playerState });

        io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} odaya katld.` });
    });

    // --- 1. WEBRTC SNYALLEME BALANGICI ---
    socket.on('ready', (roomId) => {
        const room = activeRooms[roomId];
        if (!room) return;

        // Odadaki tüm mevcut kullanclara yeni kullancnn (socket.id) katldn bildir
        // ve onlardan kendisine offer göndermelerini iste.
        socket.to(roomId).emit('userJoined', socket.id);
    });

    // --- 2. WEBRTC SNYALLEME MESAJI LETM ---
    socket.on('signal', (data) => {
        // Gelen sinyali dorudan hedef kullancya (to: ) yönlendir
        io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
    });


    socket.on('playerAction', (data) => {
        const { roomId, action, time } = data;
        const room = activeRooms[roomId];

        if (!room) return; 

        if (action === 'play') {
            room.playerState.paused = false;
        } else if (action === 'pause') {
            room.playerState.paused = true;
        }
        room.playerState.time = time; 

        socket.to(roomId).emit('syncAction', { action, time, paused: room.playerState.paused });
    });


    socket.on('sendMessage', (data) => {
        const { roomId, message, username } = data;
        io.to(roomId).emit('chatMessage', { user: username, text: message });
    });


    socket.on('disconnect', () => {
        console.log(`Kullanc ayrld: ${socket.id}`);
        
        for (const roomId in activeRooms) {
            const room = activeRooms[roomId];

            if (room.members[socket.id]) {
                const username = room.members[socket.id];
                delete room.members[socket.id]; 

                // --- 3. WEBRTC ÇIKI BLDRM ---
                // Oday terk ettiini dier kullanclara bildir
                io.to(roomId).emit('userLeft', socket.id);
                // ----------------------------------

                if (room.ownerId === socket.id) {
                    io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `Oda kurucusu (${username}) ayrld. Oda kapatlyor...` });
                    io.to(roomId).emit('roomClosed');
                    
                    delete activeRooms[roomId];
                    console.log(`Kurucu ayrld için oda silindi: ${roomId}`);
                    break;
                } else {
                    io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} odadan ayrld.` });
                    break; 
                }
            }
        }
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalyor. Uygulama Balatld.`);
});
