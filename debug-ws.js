const debugWebSocket = new WebSocket('ws://localhost:8000/chat/1/ws?token=sample'); debugWebSocket.onmessage = (event) => { console.log('Sample message received:', event.data); };
