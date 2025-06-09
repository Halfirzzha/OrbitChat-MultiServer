from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import os
import time
import json
import socket
import threading
import redis
from redis.exceptions import RedisError
from datetime import datetime

# Tambahkan dua baris ini
import eventlet
eventlet.monkey_patch()

# Kemudian lanjutkan dengan kode yang ada seperti fungsi get_local_ip(), dll.

# Fungsi untuk mendapatkan IP lokal
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        print(f"Error getting local IP: {e}")
        return "0.0.0.0"

# Baca konfigurasi dari file
def load_config():
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading config: {e}")
        return {
            "server": {
                "id": "server-auto",
                "role": "master",
                "port": 5000,
                "host": "auto"
            },
            "redis": {
                "host": "localhost",
                "port": 6379,
                "password": None,
                "db": 0
            },
            "alternative_servers": []
        }

# Inisialisasi Flask dan SocketIO
app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat_terdistri_secret'
socketio = SocketIO(
    app, 
    cors_allowed_origins='*',
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25
)

# Load config
config = load_config()

# Update host configuration dengan IP lokal jika diset "auto"
if config["server"]["host"] == "auto":
    config["server"]["host"] = get_local_ip()
    # Simpan konfigurasi yang diperbarui
    with open('config.json', 'w') as f:
        json.dump(config, f, indent=2)

# Inisialisasi koneksi Redis
redis_available = False
redis_client = None
try:
    redis_host = config.get("redis", {}).get("host", "localhost")
    redis_port = config.get("redis", {}).get("port", 6379)
    redis_password = config.get("redis", {}).get("password")
    redis_db = config.get("redis", {}).get("db", 0)
    
    redis_client = redis.Redis(
        host=redis_host,
        port=redis_port,
        db=redis_db,
        password=redis_password,
        socket_timeout=2,
        decode_responses=True
    )
    
    # Test connection
    redis_client.ping()
    redis_available = True
    print(f"Connected to Redis at {redis_host}:{redis_port}")
except (RedisError, Exception) as e:
    redis_available = False
    print(f"Failed to connect to Redis: {e}")
    print("Running in standalone mode with reduced functionality")

# Penyimpanan data sederhana (fallback jika Redis tidak tersedia)
active_users = {}
message_history = []
MAX_MESSAGES = 100
SERVER_START_TIME = datetime.now()

# Lokasi penyimpanan chat
CHAT_DIR = 'chat_history'
os.makedirs(CHAT_DIR, exist_ok=True)
chat_log_file = os.path.join(CHAT_DIR, 'chat_logs.txt')

# Fungsi untuk menyimpan pesan (terdistribusi)
def save_message(ip, username, message, token=""):
    timestamp = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    msg_id = f"{int(time.time() * 1000)}-{hash(username) % 10000}"
    
    message_data = {
        'timestamp': timestamp,
        'ip': ip,
        'username': username,
        'message': message,
        'token': token,
        'server_id': config['server']['id']
    }
    
    # Simpan ke memori lokal
    message_history.append(message_data)
    
    # Batasi jumlah pesan di memori
    if len(message_history) > MAX_MESSAGES:
        message_history.pop(0)
    
    # Simpan ke Redis jika tersedia
    if redis_available:
        try:
            # Simpan pesan sebagai hash
            redis_client.hset(f"message:{msg_id}", mapping=message_data)
            
            # Tambahkan ke sorted set untuk urutan kronologis
            redis_client.zadd("chat_messages", {msg_id: int(time.time() * 1000)})
            
            # Jika private chat, tambahkan ke channel khusus
            if token:
                redis_client.zadd(f"private_chat:{token}", {msg_id: int(time.time() * 1000)})
                
            # Batasi jumlah pesan
            if redis_client.zcard("chat_messages") > MAX_MESSAGES * 2:
                old_messages = redis_client.zrange("chat_messages", 0, 50)
                if old_messages:
                    redis_client.zrem("chat_messages", *old_messages)
                    for msg_id in old_messages:
                        redis_client.delete(f"message:{msg_id}")
        except RedisError as e:
            print(f"Redis error when saving message: {e}")
    
    # Simpan ke file
    entry = f"{timestamp} {ip} ({username}): {message}"
    with open(chat_log_file, 'a', encoding='utf-8') as f:
        f.write(entry + '\n')
    
    return timestamp, msg_id

# Fungsi untuk load message dari Redis atau file
def load_messages(token="", limit=50):
    messages = []
    
    if redis_available:
        try:
            # Pilih set yang sesuai berdasarkan token
            set_key = f"private_chat:{token}" if token else "chat_messages"
            
            # Dapatkan ID pesan terbaru
            message_ids = redis_client.zrevrange(set_key, 0, limit-1)
            
            for msg_id in message_ids:
                message_data = redis_client.hgetall(f"message:{msg_id}")
                if message_data and (not token or message_data.get('token', '') == token):
                    messages.append(message_data)
                    
            # Reverse untuk urutan kronologis
            messages.reverse()
        except RedisError as e:
            print(f"Redis error when loading messages: {e}")
    
    # Fallback ke file lokal jika Redis tidak tersedia atau tidak ada pesan
    if not redis_available or not messages:
        try:
            # Load dari file
            if os.path.exists(chat_log_file):
                with open(chat_log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()[-limit:]
                
                for line in lines:
                    parts = line.strip().split(' ', 3)
                    if len(parts) >= 4:
                        timestamp_part = parts[0] + ' ' + parts[1]
                        ip_part = parts[2]
                        rest = parts[3]
                        
                        # Parse untuk ekstrak username dan pesan
                        username_msg_parts = rest.split('): ', 1)
                        if len(username_msg_parts) == 2:
                            username = username_msg_parts[0].strip('(')
                            msg = username_msg_parts[1]
                            
                            # Untuk private chat, periksa token dalam pesan
                            if token and token not in msg:
                                continue
                                
                            messages.append({
                                'timestamp': timestamp_part,
                                'ip': ip_part,
                                'username': username,
                                'message': msg,
                                'token': token,
                                'server_id': config['server']['id']
                            })
        except Exception as e:
            print(f"Error loading chat history from file: {e}")
    
    return messages

# Fungsi untuk register active user
def register_active_user(user_id, username, ip, sid, token=""):
    user_data = {
        'username': username,
        'ip': ip,
        'join_time': datetime.now().isoformat(),
        'sid': sid,
        'server_id': config['server']['id'],
        'token': token
    }
    
    # Simpan locally
    active_users[user_id] = user_data
    
    # Simpan di Redis untuk sharing
    if redis_available:
        try:
            # Set TTL 1 jam untuk auto-cleanup jika server disconnect
            redis_client.hset(f"user:{user_id}", mapping=user_data)
            redis_client.expire(f"user:{user_id}", 3600)  # 1 jam
            
            # Update daftar active user
            redis_client.sadd("active_users", user_id)
        except RedisError as e:
            print(f"Redis error when registering user: {e}")
            
    return user_data

# Fungsi untuk get active users (filtered by token if provided)
def get_active_users(token=None):
    users = []
    
    # Dari data lokal
    for user_id, data in active_users.items():
        if token is None or data.get('token', '') == token:
            users.append(data)
    
    # Dari Redis jika tersedia
    if redis_available:
        try:
            all_user_ids = redis_client.smembers("active_users")
            for user_id in all_user_ids:
                # Skip yang sudah ada di lokal
                if user_id not in active_users:
                    user_data = redis_client.hgetall(f"user:{user_id}")
                    if user_data and (token is None or user_data.get('token', '') == token):
                        users.append(user_data)
        except RedisError as e:
            print(f"Redis error when getting active users: {e}")
    
    return users

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/history')
def get_history():
    # Check if this is a private chat request
    token = request.args.get('token', '')
    
    try:
        # Dapatkan pesan dari sistem terdistribusi
        messages = load_messages(token=token, limit=50)
        
        # Konversi ke format yang diharapkan klien
        history = []
        for msg in messages:
            # Parse pesan JSON jika ada
            message_text = msg.get('message', '')
            try:
                message_obj = json.loads(message_text)
                if isinstance(message_obj, dict) and 'text' in message_obj:
                    message_text = message_obj['text']
            except:
                # Bukan JSON, gunakan as is
                pass

            history.append({
                'metadata': f"{msg.get('timestamp', '')} {msg.get('ip', '')} ({msg.get('username', '')})",
                'msg': message_text,
                'server_id': msg.get('server_id', config['server']['id'])
            })
        
        return jsonify(history)
    except Exception as e:
        print(f"Error reading history: {e}")
        return jsonify([])

@app.route('/api/status')
def get_status():
    uptime = str(datetime.now() - SERVER_START_TIME).split('.')[0]
    
    # Hitung total user
    total_users = len(get_active_users())
    
    # Dapatkan message count
    message_count = len(message_history)
    if redis_available:
        try:
            message_count = redis_client.zcard("chat_messages")
        except RedisError:
            pass
    
    return jsonify({
        'status': 'online',
        'uptime': uptime,
        'users_count': total_users,
        'messages_count': message_count,
        'server_id': config['server']['id'],
        'role': config['server']['role']
    })

@app.route('/api/servers')
def get_servers():
    servers = []
    
    # Tambahkan server saat ini
    servers.append({
        'id': config['server']['id'],
        'url': f"http://{config['server']['host']}:{config['server']['port']}",
        'role': config['server']['role'],
        'status': 'active'
    })
    
    # Dapatkan status server dari Redis
    if redis_available:
        try:
            # Dapatkan semua server keys
            server_keys = [key for key in redis_client.keys('server:*')]
            
            for key in server_keys:
                server_id = key.split(':', 1)[1]
                # Skip server saat ini
                if server_id != config['server']['id']:
                    server_data = redis_client.hgetall(key)
                    if server_data and 'url' in server_data and 'status' in server_data:
                        servers.append({
                            'id': server_id,
                            'url': server_data['url'],
                            'role': server_data.get('role', 'unknown'),
                            'status': server_data['status']
                        })
        except RedisError as e:
            print(f"Redis error when getting servers: {e}")
    
    # Tambahkan server dari konfigurasi yang belum ada di Redis
    for server in config.get('alternative_servers', []):
        # Skip jika sudah ada di list
        if not any(s.get('id') == server.get('id') for s in servers):
            servers.append({
                'id': server.get('id', 'unknown'),
                'url': server.get('url', ''),
                'role': server.get('role', 'backup'),
                'status': 'unknown'
            })
    
    return jsonify(servers)

@app.route('/health')
def health_check():
    uptime = str(datetime.now() - SERVER_START_TIME).split('.')[0]
    return jsonify({
        'status': 'ok',
        'server_id': config['server']['id'],
        'role': config['server']['role'],
        'uptime': uptime,
        'timestamp': datetime.now().isoformat(),
        'redis_connected': redis_available
    })

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    # Broadcast server stats ke semua klien
    emit_server_stats()

@socketio.on('disconnect')
def handle_disconnect():
    # Temukan dan hapus pengguna yang terputus
    user_id = None
    user_token = None
    for uid, data in list(active_users.items()):
        if data['sid'] == request.sid:
            user_id = uid
            user_token = data.get('token', '')
            break
    
    if user_id:
        username = active_users[user_id]['username']
        ip = active_users[user_id]['ip']
        del active_users[user_id]
        
        # Hapus dari Redis juga
        if redis_available:
            try:
                redis_client.delete(f"user:{user_id}")
                redis_client.srem("active_users", user_id)
            except RedisError as e:
                print(f"Redis error when removing user: {e}")
        
        # Beritahu pengguna lain
        emit('user_left', {
            'username': username,
            'ip': ip,
            'server_id': config['server']['id'],
            'token': user_token
        }, broadcast=True)
        
        # Update daftar pengguna
        # Filter by token untuk private chat
        users_to_broadcast = get_active_users(token=user_token if user_token else None)
        emit('update_users', users_to_broadcast, broadcast=True)
        
        print(f"User left: {username} ({ip})")

@socketio.on('user_join')
def handle_join(data):
    ip = request.remote_addr or '127.0.0.1'
    username = data.get('username', 'Anonymous')
    token = data.get('token', '')
    user_id = f"{ip}-{username}-{token}"
    
    # Simpan informasi pengguna
    user_data = register_active_user(user_id, username, ip, request.sid, token)
    
    # Beritahu semua pengguna
    # Filter notifikasi based on token untuk private chat
    emit('user_joined', {
        'username': username,
        'ip': ip,
        'server_id': config['server']['id'],
        'token': token
    }, broadcast=True)
    
    # Kirim daftar pengguna terkini yang relevan
    # Filter by token untuk private chat
    users_to_broadcast = get_active_users(token=token if token else None)
    emit('update_users', users_to_broadcast, broadcast=True)
    
    print(f"User joined: {username} ({ip})")
    
    # Broadcast statistik server
    emit_server_stats()

@socketio.on('message')
def handle_message(data):
    ip = request.remote_addr or '127.0.0.1'
    
    # Parse data pesan
    if isinstance(data, dict):
        msg_text = data.get('text', '')
        token = data.get('token', '')
    else:
        msg_text = data
        token = ''
    
    # Temukan username berdasarkan SID
    username = 'Anonymous'
    for user_data in active_users.values():
        if user_data['sid'] == request.sid:
            username = user_data['username']
            break
    
    # Simpan dan broadcast pesan
    timestamp, msg_id = save_message(ip, username, json.dumps(data) if isinstance(data, dict) else data, token)
    
    # Konversi data untuk respons
    response_data = {
        'username': username,
        'ip': ip,
        'msg': msg_text,  # Gunakan text field jika dict
        'time': timestamp,
        'server_id': config['server']['id'],
        'msg_id': msg_id,
        'token': token  # Akan difilter di sisi klien
    }
    
    emit('message', response_data, broadcast=True)

# Health Check thread
def health_check_thread():
    while True:
        # Dapatkan semua server dari konfigurasi
        all_servers = config.get('alternative_servers', [])
        
        for server in all_servers:
            url = server.get('url')
            if url and url != 'auto':
                try:
                    # Kirim health check
                    import requests
                    response = requests.get(f"{url}/health", timeout=2)
                    if response.status_code == 200:
                        # Update status server ke Redis
                        if redis_available:
                            redis_client.hset(f"server:{server['id']}", mapping={
                                'status': 'active',
                                'last_seen': datetime.now().isoformat(),
                                'url': url,
                                'role': server.get('role', 'backup')
                            })
                            # Set TTL 30 detik
                            redis_client.expire(f"server:{server['id']}", 30)
                except Exception:
                    # Server tidak merespon
                    if redis_available:
                        redis_client.hset(f"server:{server['id']}", mapping={
                            'status': 'inactive',
                            'last_seen': datetime.now().isoformat(),
                            'url': url,
                            'role': server.get('role', 'backup')
                        })
        
        # Register diri sendiri
        if redis_available:
            redis_client.hset(f"server:{config['server']['id']}", mapping={
                'status': 'active',
                'last_seen': datetime.now().isoformat(),
                'url': f"http://{config['server']['host']}:{config['server']['port']}",
                'role': config['server']['role']
            })
            # Set TTL 30 detik
            redis_client.expire(f"server:{config['server']['id']}", 30)
        
        # Health check setiap 5 detik
        time.sleep(5)

# Broadcast heartbeat setiap 10 detik
def heartbeat_thread():
    while True:
        socketio.emit('heartbeat', {
            'server_id': config['server']['id'],
            'timestamp': datetime.now().isoformat()
        }, broadcast=True)
        time.sleep(10)

# Helper function untuk broadcast statistik server
def emit_server_stats():
    server_stats = {
        'id': config['server']['id'],
        'role': config['server']['role'],
        'host': config['server']['host'],
        'uptime': str(datetime.now() - SERVER_START_TIME).split('.')[0],
        'users_count': len(active_users),
        'messages_count': len(message_history) if not redis_available else redis_client.zcard("chat_messages") if redis_available else 0
    }
    
    socketio.emit('server_stats', server_stats, broadcast=True)

if __name__ == '__main__':
    print(f"\n{'='*50}")
    print("Chat-Terdistri Pro++ Server (Navy Edition)")
    print(f"Started at: {SERVER_START_TIME.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Server ID: {config['server']['id']}")
    print(f"Role: {config['server']['role']}")
    print(f"Host: {config['server']['host']}")
    print(f"Port: {config['server']['port']}")
    print(f"Redis: {'Connected' if redis_available else 'Not Connected'}")
    print(f"Chat logs: {chat_log_file}")
    print(f"{'='*50}\n")
    
    # Register server ke Redis jika tersedia
    if redis_available:
        redis_client.hset(f"server:{config['server']['id']}", mapping={
            'status': 'active',
            'last_seen': datetime.now().isoformat(),
            'url': f"http://{config['server']['host']}:{config['server']['port']}",
            'role': config['server']['role'],
            'start_time': SERVER_START_TIME.isoformat()
        })
    
    # Jalankan thread health check
    health_thread = threading.Thread(target=health_check_thread)
    health_thread.daemon = True
    health_thread.start()
    
    # Jalankan thread heartbeat
    heartbeat_thread_handle = threading.Thread(target=heartbeat_thread)
    heartbeat_thread_handle.daemon = True
    heartbeat_thread_handle.start()
    
    try:
        # Jalankan server
        host = config['server']['host']
        port = config['server']['port']
        
        print(f"Server running at http://{host}:{port}")
        socketio.run(app, host=host, port=port, debug=True, use_reloader=False)
    finally:
        print("Server shutting down, performing cleanup...")
        # Hapus server dari Redis saat shutdown
        if redis_available:
            try:
                redis_client.delete(f"server:{config['server']['id']}")
                print(f"Removed server {config['server']['id']} from registry")
            except RedisError as e:
                print(f"Error during Redis cleanup: {e}")