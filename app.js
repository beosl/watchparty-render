// app.js - Tek Dosyada Watchparty Uygulaması

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Bellekte (RAM'de) odaları ve durumlarını tutan nesne
const activeRooms = {}; 

// Rastgele 5 haneli oda ID'si üreten fonksiyon
function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}


// --- 1. HTML ve CSS/JS İçeriği (Tekrar kullanım için değişkenlerde tutulur) ---

const HLS_JS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
const SOCKET_IO_CLIENT_CDN = '/socket.io/socket.io.js'; // Bu express/socket.io tarafından otomatik sunulur

// Tüm HTML, CSS ve Client-Side JS kodlarını içeren dize
const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Watchparty MVP</title>
    <script src="${SOCKET_IO_CLIENT_CDN}"></script>
    <script src="${HLS_JS_CDN}"></script>
    <style>
        /* Profesyonel Koyu Tema CSS */
        :root {
            --bg-color: #1a1a1a;
            --card-bg: #2c2c2c;
            --text-color: #f0f0f0;
            --primary-color: #007bff;
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
            display: flex;
            gap: 20px;
        }

        #video-panel {
            flex: 3;
        }

        #chat-panel {
            flex: 1;
            min-width: 300px;
            background-color: var(--card-bg);
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            padding: 15px;
        }

        #player {
            width: 100%;
            height: auto;
            min-height: 400px; 
            max-height: 700px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        }

        #chat-container {
            height: 350px;
            overflow-y: auto;
            padding: 10px;
            background-color: var(--bg-color);
            border-radius: 4px;
            margin-bottom: 10px;
            border: 1px solid var(--border-color);
        }

        #chat-container::-webkit-scrollbar {
            width: 8px;
        }
        #chat-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }
        
        .chat-message {
            margin-bottom: 8px;
            line-height: 1.4;
        }
        .system-message { 
            color: #90ee90;
            font-style: italic; 
        }
        
        #message-input-wrapper {
            display: flex;
            gap: 10px;
        }
        #message-input {
            flex-grow: 1;
            width: auto !important;
            margin: 0 !important;
        }

        @media (max-width: 900px) {
            #room-main {
                flex-direction: column;
            }
            #chat-panel {
                min-width: 100%;
            }
        }
    </style>
</head>
<body>

    <h1>SENKRON WATCHPARTY</h1>
    <hr style="width: 80%; border-color: var(--border-color);">

    <div id="join-screen">
        <h2>Watchparty'ye Giriş</h2>
        
        <input type="text" id="username-input" placeholder="Kullanıcı Adınızı Seçin" required><br>

        <h3>Oda Oluştur</h3>
        <input type="url" id="content-url-input" placeholder="M3U8 veya MP4 Linki Yapıştırın" required><br>
        <button onclick="createRoom()">🚀 Yeni Oda Kur</button>

        <hr style="border-color: #383838; margin: 25px 0;">

        <h3>Odaya Katıl</h3>
        <input type="text" id="room-id-input" placeholder="5 Haneli Oda Numarası" required><br>
        <button onclick="joinRoom()">🚪 Odaya Gir</button>
    </div>

    <div id="room-screen">
        <h2 id="room-info" style="font-size: 1.5em; color: #aaa; margin-bottom: 20px;"></h2>
        
        <div id="room-main">
            <div id="video-panel">
                <video id="player" controls></video>
            </div>

            <div id="chat-panel">
                <h3 style="margin-top: 0;">Canlı Sohbet</h3>
                <div id="chat-container">
                    </div>
                
                <div id="message-input-wrapper">
                    <input type="text" id="message-input" placeholder="Mesajınızı yazın..." style="width: 80%;">
                    <button onclick="sendMessage()" style="padding: 10px 15px; margin: 0;">Gönder</button>
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

        function createRoom() {
            currentUsername = document.getElementById('username-input').value.trim();
            const contentUrl = document.getElementById('content-url-input').value.trim();
            if (!currentUsername || !contentUrl) { alert("Lütfen kullanıcı adı ve geçerli bir link girin."); return; }

            socket.emit('createRoom', { username: currentUsername, contentUrl: contentUrl }, (response) => {
                if (response.success) {
                    currentRoomId = response.roomId;
                    setupRoom(response.contentUrl, null);
                } else {
                    alert('Oda oluşturulurken bir hata oluştu: ' + response.message);
                }
            });
        }

        function joinRoom() {
            currentUsername = document.getElementById('username-input').value.trim();
            const roomId = document.getElementById('room-id-input').value.trim();
            if (!currentUsername || !roomId) { alert("Lütfen kullanıcı adı ve oda numarasını girin."); return; }

            socket.emit('joinRoom', { roomId: roomId, username: currentUsername }, (response) => {
                if (response.success) {
                    currentRoomId = roomId;
                    setupRoom(response.contentUrl, response.playerState);
                } else {
                    alert('Odaya katılırken bir hata oluştu: ' + response.message);
                }
            });
        }

        function setupRoom(url, state) {
            document.getElementById('join-screen').style.display = 'none';
            document.getElementById('room-screen').style.display = 'block';
            document.getElementById('room-info').innerText = \`Oda Numarası: \${currentRoomId} | Kullanıcı Adınız: \${currentUsername}\`;

            loadVideoSource(url);

            if (state) {
                isSyncing = true;
                player.currentTime = state.time;
                if (!state.paused) {
                    player.play().catch(e => console.error("Oynatma başarısız: ", e)); 
                } else {
                    player.pause();
                }
                isSyncing = false;
            }

            setupPlayerListeners();
        }

        function loadVideoSource(url) {
            if (url.includes('.m3u8')) {
                if (Hls.isSupported()) {
                    if (hls) hls.destroy(); // Önceki örneği temizle
                    hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(player);
                } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
                    player.src = url;
                } else {
                    alert('Tarayıcınız M3U8 (HLS) akışını desteklemiyor.');
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
                player.play().catch(e => console.error("Oynatma başarısız (Sync): ", e));
            } else if (data.action === 'pause') {
                player.currentTime = data.time;
                player.pause();
            }
            setTimeout(() => isSyncing = false, 500);
        });

        socket.on('chatMessage', (data) => {
            const chatBox = document.getElementById('chat-container');
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message');
            
            let messageText = '';
            if (data.user === 'Sistem') {
                messageText = \`<span class="system-message">\${data.user}: \${data.text}</span>\`;
            } else {
                messageText = \`<strong>\${data.user}:</strong> \${data.text}\`;
            }

            messageElement.innerHTML = messageText;
            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        socket.on('roomClosed', () => {
            alert("Oda kurucusu ayrıldığı için bu oda kapatıldı.");
            document.getElementById('room-screen').style.display = 'none';
            document.getElementById('join-screen').style.display = 'block';
            currentRoomId = null;
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
    </script>
</body>
</html>
`;


// --- 2. Sunucu Yönlendirmeleri ve Socket.IO Mantığı ---

// Ana sayfa yönlendirmesi: Hazırladığımız HTML içeriğini gönder
app.get('/', (req, res) => {
  res.send(FRONTEND_HTML);
});


io.on('connection', (socket) => {
    console.log(`Yeni kullanıcı bağlandı: ${socket.id}`);

    // ODA OLUŞTURMA İŞLEMİ
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
        io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} odayı kurdu ve yayını başlattı!` });
    });

    // ODAYA KATILMA İŞLEMİ
    socket.on('joinRoom', (data, callback) => {
        const { roomId, username } = data;
        const room = activeRooms[roomId];

        if (!room) {
            return callback({ success: false, message: 'Bu oda bulunamadı veya kapatıldı.' });
        }
        
        // Zaten odada olup olmadığını kontrol et
        if (Object.values(room.members).includes(username)) {
            // Basit bir kontrol, veritabanı olmadığı için daha detaylı olamaz
            return callback({ success: false, message: 'Bu kullanıcı adı zaten bu odada kullanılıyor.' });
        }


        room.members[socket.id] = username;
        socket.join(roomId);
        
        callback({ success: true, contentUrl: room.contentUrl, playerState: room.playerState });

        io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} odaya katıldı.` });
    });


    // OYNATICI SENKRONİZASYON İŞLEMLERİ
    socket.on('playerAction', (data) => {
        const { roomId, action, time } = data;
        const room = activeRooms[roomId];

        if (!room) return; 

        // Oynatıcı durumunu güncelle
        if (action === 'play') {
            room.playerState.paused = false;
        } else if (action === 'pause') {
            room.playerState.paused = true;
        }
        // Hem seek hem de pause/play olaylarında zamanı güncelle
        room.playerState.time = time; 

        // Aksiyonu odadaki diğer herkese yayınla (kendisi hariç)
        socket.to(roomId).emit('syncAction', { action, time, paused: room.playerState.paused });
    });


    // METİN MESAJLAŞMA İŞLEMİ
    socket.on('sendMessage', (data) => {
        const { roomId, message, username } = data;
        io.to(roomId).emit('chatMessage', { user: username, text: message });
    });


    // BAĞLANTI KESİLİNCE TEMİZLEME
    socket.on('disconnect', () => {
        console.log(`Kullanıcı ayrıldı: ${socket.id}`);
        
        for (const roomId in activeRooms) {
            const room = activeRooms[roomId];

            if (room.members[socket.id]) {
                const username = room.members[socket.id];
                delete room.members[socket.id]; 

                // Kurucu ayrılırsa odayı kapat
                if (room.ownerId === socket.id) {
                    io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `Oda kurucusu (${username}) ayrıldı. Oda kapatılıyor...` });
                    io.to(roomId).emit('roomClosed');
                    
                    delete activeRooms[roomId];
                    console.log(`Kurucu ayrıldığı için oda silindi: ${roomId}`);
                    break;
                } else {
                    // Normal üye ayrıldı
                    io.to(roomId).emit('chatMessage', { user: 'Sistem', text: `${username} odadan ayrıldı.` });
                    break; 
                }
            }
        }
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor. Uygulama Başlatıldı.`);
  console.log('----------------------------------------------------');
  console.log('Odalardaki tüm veriler SUNUCU KAPANDIĞINDA SİLİNİR.');
  console.log('----------------------------------------------------');
});
