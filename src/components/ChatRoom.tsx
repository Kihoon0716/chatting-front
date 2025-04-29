import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Socket } from 'socket.io-client'
import axios from 'axios'
import './ChatRoom.css'

// API_URL을 환경 변수로 변경
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

// WebSocket 타입 정의
interface WebSocketWithConnect extends WebSocket {
  connected?: boolean;
}

interface Message {
  id: string | number
  content: string
  username: string  // 화면 표시용으로 sender_username을 변환
  sender_username?: string  // API에서 오는 원래 필드
  timestamp: string
  created_at?: string  // API에서 오는 시간 필드
  room_id: string
  is_system?: boolean
  type?: string
  is_deleted?: boolean
  client_timestamp?: string
}

interface Friend {
  username: string
  created_at?: string
}

interface ChatRoomType {
  id: string;
  name: string;
  created_by: string;
  participants_count: number;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_time?: string;
  is_admin: boolean;
}

interface Participant {
  username: string
  is_admin: boolean
  joined_at: string
}

const ChatRoomComponent = () => {
  const [socket, setSocket] = useState<WebSocketWithConnect | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [friends, setFriends] = useState<Friend[]>([])
  const [newFriend, setNewFriend] = useState('')
  const [addingFriend, setAddingFriend] = useState(false)
  const [friendError, setFriendError] = useState('')
  const [chatRooms, setChatRooms] = useState<ChatRoomType[]>([])
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoomType | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [page, setPage] = useState(1)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [inviteUsernames, setInviteUsernames] = useState<string[]>([])
  const [inviteUsername, setInviteUsername] = useState('')
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  const username = localStorage.getItem('username') || '익명'
  const token = localStorage.getItem('token')

  // 모든 채팅방의 참여자 정보 저장을 위한 상태 추가
  const [allRoomParticipants, setAllRoomParticipants] = useState<{[key: string]: Participant[]}>({})
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // 채팅방 목록 가져오기
  const fetchChatRooms = async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true)
    }
    try {
      const response = await axios.get(`${API_URL}/chat/rooms/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      console.log('채팅방 목록 원본 응답:', response.data)
      console.log('채팅방 목록 응답 타입:', typeof response.data)
      console.log('채팅방 목록 응답 구조:', JSON.stringify(response.data, null, 2))
      
      // 서버 응답 구조에 맞게 데이터 추출
      let rooms = [];
      if (response.data && Array.isArray(response.data)) {
        // 배열인 경우
        rooms = response.data;
        console.log('응답이 직접 배열로 왔습니다.');
      } else if (response.data && response.data.items && Array.isArray(response.data.items)) {
        // items 속성에 배열이 있는 경우
        rooms = response.data.items;
        console.log('items 속성에서 배열을 추출했습니다.');
      } else if (response.data && response.data.chat_rooms && Array.isArray(response.data.chat_rooms)) {
        // chat_rooms 속성에 배열이 있는 경우
        rooms = response.data.chat_rooms;
        console.log('chat_rooms 속성에서 배열을 추출했습니다.');
      } else if (response.data && response.data.rooms && Array.isArray(response.data.rooms)) {
        // rooms 속성에 배열이 있는 경우
        rooms = response.data.rooms;
        console.log('rooms 속성에서 배열을 추출했습니다.');
      } else {
        // 형식을 알 수 없는 경우 빈 배열 설정
        rooms = [];
        console.warn('알 수 없는 채팅방 데이터 형식:', response.data);
        console.warn('response.data의 키들:', Object.keys(response.data || {}));
      }
      
      // 최종 확인: 배열이 아니면 빈 배열로 설정
      if (!Array.isArray(rooms)) {
        console.error('추출된 rooms가 배열이 아닙니다:', rooms);
        rooms = [];
      }
      
      console.log('최종 처리된 채팅방 목록:', rooms);
      setChatRooms(rooms);
      
      // 첫 번째 채팅방 선택
      if (rooms.length > 0 && !selectedChatRoom) {
        console.log('첫 번째 채팅방 선택:', rooms[0])
        setSelectedChatRoom(rooms[0])
      } else if (selectedChatRoom) {
        // 채팅방 목록이 업데이트되었을 때 현재 선택된 채팅방의 최신 정보로 업데이트
        const updatedRoom = rooms.find((room: ChatRoomType) => room.id === selectedChatRoom.id)
        if (updatedRoom) {
          setSelectedChatRoom(updatedRoom)
        }
      }
    } catch (error: any) {
      console.error('채팅방 목록 로드 중 오류 발생:', error)
      if (error.response) {
        console.error('서버 응답 오류:', error.response.status, error.response.data)
      }
      // 오류 발생 시 빈 배열로 설정하여 에러 방지
      setChatRooms([]);
    } finally {
      if (showLoading) {
        setIsRefreshing(false)
      }
    }
  }

  // 채팅방 메시지 가져오기
  const fetchMessages = async (roomId: string, messagePage = 1, reset = false) => {
    if (!roomId) return
    
    try {
      setLoadingMessages(true)
      const response = await axios.get(`${API_URL}/chat/${roomId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          page: messagePage,
          page_size: 20
        }
      })
      
      console.log('API에서 가져온 메시지 데이터:', response.data);
      
      // 서버 응답 형식에 따라 처리 방식 수정
      let newMessages: Message[] = [];
      
      if (response.data && Array.isArray(response.data.messages)) {
        // API 새 형식 (messages 배열이 있는 경우)
        newMessages = response.data.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.is_deleted ? '[삭제된 메시지]' : msg.content,
          username: msg.sender_username, // username 필드에 sender_username 값을 사용
          sender_username: msg.sender_username,
          timestamp: msg.created_at, // timestamp 필드에 created_at 값을 사용
          created_at: msg.created_at,
          room_id: roomId,
          is_deleted: msg.is_deleted,
          client_timestamp: msg.client_timestamp
        }));
      } else if (response.data && Array.isArray(response.data)) {
        // 기존 배열 형식 (호환성 유지)
        newMessages = response.data.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          username: msg.username || msg.sender_username, 
          sender_username: msg.sender_username || msg.username,
          timestamp: msg.timestamp || msg.created_at,
          created_at: msg.created_at || msg.timestamp,
          room_id: roomId
        }));
      } else if (response.data && Array.isArray(response.data.items)) {
        // items 속성에 배열이 있는 경우 (호환성 유지)
        newMessages = response.data.items.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          username: msg.username || msg.sender_username,
          sender_username: msg.sender_username || msg.username,
          timestamp: msg.timestamp || msg.created_at,
          created_at: msg.created_at || msg.timestamp,
          room_id: roomId
        }));
      } else {
        // 형식을 알 수 없는 경우 빈 배열 설정
        newMessages = [];
        console.warn('알 수 없는 메시지 데이터 형식:', response.data);
      }
      
      console.log('처리된 메시지 배열:', newMessages);
      
      // 페이지네이션 처리
      if (reset) {
        setMessages(newMessages)
        // 첫 페이지 메시지 로드 시 스크롤을 맨 아래로 이동
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages(prev => [...newMessages, ...prev])
      }
      
      // 서버에서 전체 페이지 정보를 제공하는 경우
      if (response.data && typeof response.data.total_count === 'number') {
        setHasMoreMessages(newMessages.length > 0 && newMessages.length * messagePage < response.data.total_count);
      } else {
        // 페이지 정보가 없는 경우 기존 로직 사용
        setHasMoreMessages(newMessages.length === 20);
      }
      
      setPage(messagePage);
    } catch (error: any) {
      console.error('메시지 로드 중 오류 발생:', error)
      if (error.response && error.response.status === 404) {
        // 새로 생성된 채팅방은 메시지가 없을 수 있음
        setMessages([])
        setHasMoreMessages(false)
      }
    } finally {
      setLoadingMessages(false)
    }
  }

  // 채팅방 참여자 가져오기
  const fetchParticipants = async (roomId: string) => {
    if (!roomId) return
    
    console.log(`채팅방 ${roomId}의 참여자 정보 가져오기 (채팅방 선택 시 1회만 실행)`)
    
    try {
      const response = await axios.get(`${API_URL}/chat/${roomId}/participants/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const participantsList = response.data || []
      setParticipants(participantsList)
      
      // 전체 참여자 목록에도 업데이트
      setAllRoomParticipants(prev => ({
        ...prev,
        [roomId]: participantsList
      }))
    } catch (error: any) {
      console.error('참여자 목록 로드 중 오류 발생:', error)
      if (error.response && error.response.status === 404) {
        // 새로 생성된 채팅방의 참여자 정보가 아직 없을 수 있음
        setParticipants([])
      }
    }
  }

  // 모든 채팅방의 참여자 정보 가져오기
  const fetchAllRoomParticipants = async () => {
    if (!chatRooms || chatRooms.length === 0) return
    
    // 동시에 모든 채팅방의 참여자 정보 가져오기
    const promises = chatRooms.map(room => 
      axios.get(`${API_URL}/chat/${room.id}/participants/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        const participantsList = response.data || []
        setAllRoomParticipants(prev => ({
          ...prev,
          [room.id]: participantsList
        }))
        return { roomId: room.id, success: true }
      })
      .catch(error => {
        console.error(`방 ${room.id}의 참여자 목록 로드 중 오류 발생:`, error)
        return { roomId: room.id, success: false }
      })
    )
    
    await Promise.all(promises)
  }

  // 채팅방 목록 가져온 후 모든 참여자 정보 가져오기
  useEffect(() => {
    if (Array.isArray(chatRooms) && chatRooms.length > 0) {
      // 채팅방 목록이 처음 로드되었을 때만 참여자 정보 가져오기
      // 더 이상 채팅방 목록이 변경될 때마다 참여자 정보를 가져오지 않음
      if (Object.keys(allRoomParticipants).length === 0) {
        console.log('채팅방 목록 최초 로드 시 참여자 정보 한 번만 가져오기')
        fetchAllRoomParticipants()
      }
    }
  }, [chatRooms, allRoomParticipants])

  // WebSocket 연결 및 관리
  const connectWebSocket = (roomId: string) => {
    if (!token || !roomId) {
      console.error('WebSocket 연결 실패: 토큰 또는 방 ID가 없습니다.');
      return;
    }
    
    // 기존 소켓이 있으면 먼저 닫기
    if (socket) {
      console.log('기존 WebSocket 연결 닫기');
      socket.close();
    }
    
    try {
      // WebSocket URL 생성 (HTTP를 WS로 변경)
      let wsUrl = API_URL.replace('http:', 'ws:')
      if (API_URL.includes('https:')) {
        wsUrl = API_URL.replace('https:', 'wss:')
      }
      
      // 백엔드 서버의 URL 구조에 맞게 조정
      // URL 끝에 슬래시가 있는지 확인하고 제거
      if (wsUrl.endsWith('/')) {
        wsUrl = wsUrl.slice(0, -1);
      }
      
      // API 명세에 맞는 WebSocket URL 구성: /chat/rooms/{room_id}/ws?token={token}
      const fullWsUrl = `${wsUrl}/chat/rooms/${roomId}/ws?token=${token}`;
      console.log(`WebSocket 연결 시도: ${fullWsUrl}`);
      
      // 채팅방 별 WebSocket 연결
      const chatSocket = new WebSocket(fullWsUrl) as WebSocketWithConnect;
      
      // 연결 시도 시간 기록 (타임아웃 처리용)
      const connectionStartTime = Date.now();
      
      // 연결 대기 상태 표시
      setLoading(true);
      
      chatSocket.onopen = () => {
        console.log(`채팅방 ${roomId}에 WebSocket 연결됨 - ReadyState:`, chatSocket.readyState);
        chatSocket.connected = true;
        
        // 연결 성공 시 WebSocket 상태 업데이트
        setSocket(chatSocket);
        setLoading(false);
        
        // 시스템 메시지로 연결 상태 표시 (선택적)
        // 이미 비슷한 메시지가 있는지 확인
        const hasConnectMessage = messages.some(msg => 
          msg.is_system && 
          (msg.content === '채팅방에 연결되었습니다.' || 
           msg.content.includes('입장했습니다'))
        );
        
        // 연결 메시지가 없는 경우만 표시
        if (!hasConnectMessage) {
          setMessages(prev => [...prev, {
            id: `system-connect-${Date.now()}`,
            content: '채팅방에 연결되었습니다.',
            username: 'System',
            timestamp: new Date().toISOString(),
            room_id: roomId,
            is_system: true
          }]);
        }
      };
      
      chatSocket.onmessage = (event) => {
        try {
          // 원본 데이터 로깅
          console.log(`WebSocket 메시지 수신 (원본): `, event.data);
          
          // 메시지 파싱 시도
          let receivedData;
          try {
            // 서버에서 JSON 형식으로 메시지가 오는 경우
            receivedData = JSON.parse(event.data);
            console.log('파싱된 JSON 데이터:', receivedData);
            
            // 메시지 타입에 따른 처리
            if (receivedData.type === 'system') {
              // 시스템 메시지 (사용자 입장/퇴장 등)
              const systemMessage: Message = {
                id: receivedData.id || `system-${Date.now()}`,
                content: receivedData.content || receivedData.message,
                username: 'System',
                timestamp: receivedData.timestamp || receivedData.created_at || new Date().toISOString(),
                room_id: roomId,
                is_system: true
              };
              
              // 내용이 없는 시스템 메시지는 무시
              if (systemMessage.content && systemMessage.content.trim() !== '') {
                // 중복 시스템 메시지 확인
                const isDuplicateSystem = messages.some(msg => 
                  msg.is_system && 
                  msg.content === systemMessage.content &&
                  Math.abs(new Date(msg.timestamp).getTime() - new Date(systemMessage.timestamp).getTime()) < 10000
                );
                
                if (!isDuplicateSystem) {
                  setMessages(prev => [...prev, systemMessage]);
                } else {
                  console.log('중복 시스템 메시지 무시됨:', systemMessage);
                }
              } else {
                console.log('빈 내용의 시스템 메시지 무시됨:', systemMessage);
              }
            } else if (receivedData.type === 'user_list') {
              // 사용자 목록 업데이트 (필요시 처리)
              console.log('채팅방 사용자 목록 업데이트:', receivedData.users);
            } else {
              // 일반 채팅 메시지
              const chatMessage: Message = {
                id: receivedData.id || `msg-${Date.now()}`,
                content: receivedData.is_deleted ? '[삭제된 메시지]' : (receivedData.content || receivedData.message),
                username: receivedData.sender_username || receivedData.username || '알 수 없음',
                sender_username: receivedData.sender_username || receivedData.username,
                timestamp: receivedData.created_at || receivedData.timestamp || new Date().toISOString(),
                created_at: receivedData.created_at || receivedData.timestamp,
                room_id: roomId,
                is_deleted: receivedData.is_deleted || false,
                client_timestamp: receivedData.client_timestamp
              };
              
              // 수신된 메시지 필드 디버깅
              console.log('수신된 메시지 필드 확인:', {
                id: receivedData.id,
                content: receivedData.content,
                message: receivedData.message,
                username: receivedData.username,
                sender_username: receivedData.sender_username,
                timestamp: receivedData.timestamp,
                created_at: receivedData.created_at,
                is_deleted: receivedData.is_deleted
              });
              
              // 중복 확인 - 동일한 ID 또는 내가 보낸 메시지가 서버로부터 돌아온 경우는 표시하지 않음
              const isDuplicate = messages.some(msg => 
                msg.id === chatMessage.id || 
                // 같은 내용, 같은 사용자, 비슷한 시간대(5초 이내)의 메시지는 중복으로 처리
                (msg.content === chatMessage.content && 
                 msg.username === chatMessage.username &&
                 Math.abs(new Date(msg.timestamp).getTime() - new Date(chatMessage.timestamp).getTime()) < 5000)
              );
              
              // 내용이 없는 메시지인지 확인
              const isEmpty = !chatMessage.content || 
                             chatMessage.content === '(내용 없음)' || 
                             chatMessage.content.trim() === '';
              
              console.log('메시지 중복 여부:', isDuplicate, '메시지 빈 여부:', isEmpty, '메시지:', chatMessage);
              
              // 중복이 아니고 내용이 있는 메시지만 표시
              if (!isDuplicate && !isEmpty) {
                setMessages(prev => [...prev, chatMessage]);
                // 새 메시지가 오면 스크롤을 아래로 이동
                setTimeout(scrollToBottom, 100);
              } else if (isDuplicate) {
                console.log('중복 메시지 무시됨:', chatMessage);
              } else if (isEmpty) {
                console.log('빈 메시지 무시됨:', chatMessage);
              }
            }
          } catch (parseError) {
            // 서버에서 단순 텍스트로 메시지가 오는 경우 처리
            console.error('JSON 파싱 오류:', parseError);
            console.log('텍스트 메시지 수신 (원본):', event.data);
            
            // 텍스트 메시지도 채팅창에 표시
            if (typeof event.data === 'string' && event.data.trim()) {
              setMessages(prev => [...prev, {
                id: `text-${Date.now()}`,
                content: event.data,
                username: 'System',
                timestamp: new Date().toISOString(),
                room_id: roomId,
                is_system: true
              }]);
            }
          }
        } catch (err) {
          console.error('WebSocket 메시지 처리 중 오류:', err);
        }
      };
      
      chatSocket.onerror = (event: Event) => {
        console.error('WebSocket 오류 발생:', event);
        // 에러 세부 정보 로깅
        console.error('WebSocket 오류 상세 정보:', {
          readyState: chatSocket.readyState,
          url: chatSocket.url,
          protocol: chatSocket.protocol,
          timestamp: new Date().toISOString()
        });
        
        // 에러 메시지 표시
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          content: '채팅 연결 중 오류가 발생했습니다. 잠시 후 자동으로 재연결을 시도합니다.',
          username: 'System',
          timestamp: new Date().toISOString(),
          room_id: roomId,
          is_system: true,
          type: 'error'
        }]);
        
        setLoading(false);
      };
      
      chatSocket.onclose = (event) => {
        console.log(`채팅방 ${roomId}의 WebSocket 연결 종료. 코드: ${event.code}, 이유: ${event.reason || '알 수 없음'}`);
        chatSocket.connected = false;
        
        // WebSocket 상태 업데이트
        setSocket(null);
        setLoading(false);
        
        // 종료 코드에 따른 메시지 생성
        let closeMessage = '';
        if (event.code === 1000) {
          closeMessage = '정상적으로 채팅 연결이 종료되었습니다.';
          console.log('정상적으로 WebSocket 연결 종료');
        } else if (event.code === 1001) {
          closeMessage = '페이지를 떠나 채팅 연결이 종료되었습니다.';
        } else if (event.code === 1008) {
          closeMessage = '인증 실패: 로그인이 만료되었거나 권한이 부족합니다.';
          console.error('WebSocket 연결 권한 오류: 인증 실패 또는 권한 부족');
        } else if (event.code === 1011) {
          closeMessage = '서버 내부 오류가 발생했습니다.';
        } else if (event.code === 1013) {
          closeMessage = '채팅방이 존재하지 않습니다.';
          console.warn('채팅방이 존재하지 않습니다. 잠시 후 다시 시도하세요.');
        } else {
          closeMessage = '채팅 연결이 종료되었습니다. 재연결을 시도합니다.';
        }
        
        // 연결 종료 메시지 표시 (비정상 종료인 경우만)
        if (event.code !== 1000 && event.code !== 1001) {
          setMessages(prev => [...prev, {
            id: `close-${Date.now()}`,
            content: closeMessage,
            username: 'System',
            timestamp: new Date().toISOString(),
            room_id: roomId,
            is_system: true,
            type: 'error'
          }]);
          
          // 비정상 종료인 경우 재연결 시도
          console.log('WebSocket 재연결 시도...');
          setTimeout(() => {
            if (selectedChatRoom && selectedChatRoom.id === roomId) {
              connectWebSocket(roomId);
            }
          }, 3000); // 3초 후 재시도
        }
      };
      
      // 연결 타임아웃 처리
      const connectionTimeout = setTimeout(() => {
        // 10초 안에 연결되지 않으면 타임아웃으로 간주
        if (chatSocket.readyState !== WebSocket.OPEN) {
          console.error('WebSocket 연결 타임아웃');
          chatSocket.close(4000, '연결 타임아웃');
          
          setLoading(false);
          setMessages(prev => [...prev, {
            id: `timeout-${Date.now()}`,
            content: '채팅 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
            username: 'System',
            timestamp: new Date().toISOString(),
            room_id: roomId,
            is_system: true,
            type: 'error'
          }]);
        }
        
        clearTimeout(connectionTimeout);
      }, 10000);
      
      // 소켓 상태 저장
      setSocket(chatSocket);
    } catch (error: unknown) {
      console.error('WebSocket 연결 생성 중 예외 발생:', error);
      setLoading(false);
      
      // 예외 발생 시 에러 메시지 표시
      setMessages(prev => [...prev, {
        id: `connection-error-${Date.now()}`,
        content: '채팅 연결을 시도하는 중 오류가 발생했습니다: ' + 
          (error instanceof Error ? error.message : '알 수 없는 오류'),
        username: 'System',
        timestamp: new Date().toISOString(),
        room_id: roomId,
        is_system: true,
        type: 'error'
      }]);
      
      // 연결 상태 초기화
      setSocket(null);
    }
  };

  // 주기적인 WebSocket 연결 상태 체크
  useEffect(() => {
    if (!selectedChatRoom) return;
    
    const checkSocketInterval = setInterval(() => {
      if (socket) {
        console.log('현재 WebSocket 상태:', {
          readyState: socket.readyState,
          connected: socket.connected,
          url: socket.url
        });
        
        // 연결이 끊어진 경우 재연결
        if (socket.readyState !== WebSocket.OPEN) {
          console.log('WebSocket 연결 끊김 감지, 재연결 시도...');
          connectWebSocket(selectedChatRoom.id);
        }
      } else {
        console.log('WebSocket이 존재하지 않음, 연결 시도...');
        connectWebSocket(selectedChatRoom.id);
      }
    }, 10000); // 10초마다 체크
    
    return () => {
      clearInterval(checkSocketInterval);
    };
  }, [selectedChatRoom?.id, socket]);

  // 채팅방 선택 시 추가 확인 단계 추가
  useEffect(() => {
    if (selectedChatRoom) {
      console.log('채팅방 선택됨:', selectedChatRoom);
      fetchMessages(selectedChatRoom.id, 1, true);
      fetchParticipants(selectedChatRoom.id);
      
      // WebSocket 연결 시도
      console.log('선택된 채팅방에 대한 WebSocket 연결 시도...');
      // 잠시 대기 후 WebSocket 연결 (메시지 로드 후)
      setTimeout(() => {
        connectWebSocket(selectedChatRoom.id);
      }, 500);
    }
    
    // 컴포넌트 언마운트 시 WebSocket 연결 해제
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [selectedChatRoom?.id]); // selectedChatRoom 대신 selectedChatRoom.id를 의존성으로 설정

  // 메인 페이지 로드 시 초기화
  useEffect(() => {
    // 토큰이 없으면 로그인 페이지로 리다이렉트
    if (!token) {
      navigate('/')
      return
    }

    // 친구 목록 가져오기
    const fetchFriends = async () => {
      try {
        const response = await axios.get(`${API_URL}/friends/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        setFriends(response.data.friends || [])
      } catch (error) {
        console.error('친구 목록 로드 중 오류 발생:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchChatRooms()
    fetchFriends()

    // 정리 함수
    return () => {
      // WebSocket 연결 해제
      if (socket) {
        socket.close()
      }
    }
  }, [navigate, token])

  // 메시지 배열이 변경될 때마다 스크롤 조정
  useEffect(() => {
    // 메시지가 추가되면 스크롤 아래로 이동
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // 메시지 컨테이너 참조 설정 및 초기 스크롤 설정
  useEffect(() => {
    // 메시지 컨테이너 참조가 설정되면 즉시 스크롤을 아래로 이동
    if (messagesContainerRef.current && messages.length > 0) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messagesContainerRef.current, selectedChatRoom?.id]);

  // 메시지 컨테이너 스크롤 이벤트 처리
  useEffect(() => {
    const handleScroll = () => {
      const container = messagesContainerRef.current
      if (container && container.scrollTop === 0 && hasMoreMessages && !loadingMessages) {
        // 스크롤이 맨 위에 도달하면 이전 메시지 로드
        if (selectedChatRoom) {
          fetchMessages(selectedChatRoom.id, page + 1)
        }
      }
    }
    
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
    }
  }, [selectedChatRoom, page, hasMoreMessages, loadingMessages])

  // 스크롤을 맨 아래로 이동하는 함수 강화
  const scrollToBottom = () => {
    // timeout을 사용하여 DOM 업데이트 후 스크롤 이동 보장
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } else if (messagesContainerRef.current) {
        // 참조가 없는 경우 컨테이너의 스크롤 직접 조작
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 50);
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // 한글 입력 중 IME 작성 중인지 확인
    if (e.nativeEvent.isComposing) {
      return; // IME 조합 중이면 처리하지 않음
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChatRoom || !token) return

    const trimmedMessage = newMessage.trim();
    const currentTimestamp = new Date().toISOString();
    
    // 메시지 입력창 비우기 - 중복 전송 방지를 위해 먼저 비우기
    setNewMessage('');
    
    // API 명세에 맞는 메시지 데이터 형식
    const messagePayload = {
      content: trimmedMessage,
      sender_username: username,
      timestamp: currentTimestamp
    };
    
    const tempId = `temp-${Date.now()}`;
    
    try {
      // WebSocket이 연결되어 있으면 WebSocket으로 메시지 전송
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('WebSocket 상태:', socket.readyState, socket.connected);
        
        try {
          // WebSocket으로 보낼 때는 화면에 메시지를 표시하지 않음
          // WebSocket의 onmessage 이벤트에서 메시지를 받아 표시함
          socket.send(JSON.stringify(messagePayload));
          console.log('WebSocket으로 메시지 전송 완료:', messagePayload);
          
          // 스크롤을 아래로 이동
          setTimeout(scrollToBottom, 100);
          return;
        } catch (wsError) {
          console.error('WebSocket 메시지 전송 실패, REST API로 대체:', wsError);
          // WebSocket 전송 실패 시 REST API로 폴백
        }
      } else {
        console.log('WebSocket 연결 없음, REST API로 전송');
      }
      
      // WebSocket이 없거나 연결되지 않은 경우 REST API로 메시지 전송
      console.log('REST API로 메시지 전송 시도:', messagePayload);
      
      // REST API 사용 시에만 낙관적 UI 업데이트 적용
      const myMessage: Message = {
        id: tempId,
        content: trimmedMessage,
        username: username,
        timestamp: currentTimestamp,
        room_id: selectedChatRoom.id
      };
      
      // REST API 사용 시 화면에 즉시 메시지 표시
      setMessages(prev => [...prev, myMessage]);
      
      const response = await axios.post(`${API_URL}/chat/${selectedChatRoom.id}/messages`, messagePayload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8'
        }
      });
      
      console.log('REST API 메시지 전송 응답:', response.data);
      
      // 서버에서 실제 ID를 받아와서 임시 메시지를 업데이트할 수 있음
      if (response.data && response.data.id) {
        // 임시 ID로 메시지를 찾아 서버 ID로 업데이트
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, id: response.data.id } 
              : msg
          )
        );
      }
      
      // 스크롤을 아래로 이동
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('메시지 전송 중 오류 발생:', error);
      // 오류 발생 시 메시지 상태 표시 (실패 표시)
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, content: `${trimmedMessage} (전송 실패)` } 
            : msg
        )
      );
      alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleAddFriend = async () => {
    if (!newFriend.trim()) {
      setFriendError('친구 이름을 입력해주세요')
      return
    }

    try {
      setAddingFriend(true)
      setFriendError('')
      
      const response = await axios.post(`${API_URL}/friends/`, {
        username: newFriend
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      // 친구 추가 성공
      setFriends(prev => [...prev, { username: newFriend }])
      setNewFriend('')
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.detail) {
        setFriendError(error.response.data.detail)
      } else {
        setFriendError('친구 추가 중 오류가 발생했습니다')
      }
    } finally {
      setAddingFriend(false)
    }
  }

  const handleFriendKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddFriend()
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('username')
    localStorage.removeItem('token')
    navigate('/')
  }

  const selectChatRoom = (chatRoom: ChatRoomType) => {
    setSelectedChatRoom(chatRoom);
    // 채팅방 선택 시 로딩이 완료된 후 스크롤을 맨 아래로 이동
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  }

  const createChatRoom = async () => {
    if (!newRoomName.trim()) return
    
    // 입력 필드에 값이 있으면 먼저 추가하기
    if (inviteUsername.trim() && !inviteUsernames.includes(inviteUsername) && inviteUsername !== username) {
      // 입력 필드에 있던 사용자 추가
      setInviteUsernames(prev => [...prev, inviteUsername]);
      
      // 디버깅용 로그
      console.log('입력 필드에 있던 사용자 추가:', inviteUsername);
      console.log('모든 초대 사용자 (추가 후):', [...inviteUsernames, inviteUsername]);
      
      // 채팅방 생성 진행 (업데이트된 inviteUsernames 배열은 아직 반영되지 않았으므로 직접 사용)
      const allParticipants = [username, ...inviteUsernames, inviteUsername];
      sendChatRoomRequest(allParticipants);
    } else {
      // 입력 필드가 비어있거나 이미 추가된 사용자인 경우
      const allParticipants = [username, ...inviteUsernames];
      sendChatRoomRequest(allParticipants);
    }
  }
  
  // 채팅방 생성 요청 보내는 함수 분리
  const sendChatRoomRequest = async (participants: string[]) => {
    // API 요청 페이로드 준비
    const payload = {
      name: newRoomName,
      participants: participants
    }
    
    console.log('채팅방 생성 요청 데이터:', payload);
    console.log('사용자 이름:', username);
    console.log('초대할 사용자 목록:', participants.filter(p => p !== username));
    console.log('전체 참여자 목록:', participants);
    
    try {
      // 실제 API 요청
      const response = await axios.post(`${API_URL}/chat/rooms/`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('채팅방 생성 성공:', response.data)
      
      // 생성 후 폼 초기화
      setNewRoomName('')
      setInviteUsernames([])
      setInviteUsername('')
      setShowCreateRoom(false)
      
      // 채팅방 목록 다시 가져오기
      fetchChatRooms()
    } catch (error: any) {
      console.error('채팅방 생성 중 오류 발생:', error)
      if (axios.isAxiosError(error) && error.response) {
        // 요청이 발송되었으나 서버에서 응답으로 오류 상태 코드를 보낸 경우
        console.error('서버 오류 응답:', error.response.status, error.response.data)
        alert(`채팅방 생성 실패: ${error.response.data.message || error.response.data.error || '서버 오류'}`)
      } else {
        // 요청 설정 중 오류가 발생한 경우
        console.error('요청 오류:', error.message)
        alert(`요청 오류: ${error.message}`)
      }
    }
  }

  const addUserToInvite = () => {
    if (
      !inviteUsername.trim() || 
      inviteUsernames.includes(inviteUsername) ||
      inviteUsername === username
    ) return
    
    setInviteUsernames(prev => [...prev, inviteUsername])
    setInviteUsername('')
  }

  const removeUserFromInvite = (username: string) => {
    setInviteUsernames(prev => prev.filter(u => u !== username))
  }
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    } else {
      return date.toLocaleDateString([], {month: 'short', day: 'numeric'})
    }
  }

  // 메시지 삭제 함수
  const deleteMessage = async (messageId: string) => {
    if (!selectedChatRoom || !token) return;
    
    try {
      await axios.delete(`${API_URL}/chat/${selectedChatRoom.id}/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 메시지 목록 갱신
      fetchMessages(selectedChatRoom.id, 1, true);
    } catch (error) {
      console.error('메시지 삭제 중 오류 발생:', error);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      console.log('현재 표시된 메시지 목록:', messages);
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>채팅</h2>
        <div className="user-info">
          <span>{username}님 안녕하세요!</span>
          <button className="logout-button" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
      
      <div className="chat-content">
        {/* 좌측: 친구 목록 */}
        <div className="friends-panel">
          <div className="friends-header">
            <h3>친구 목록</h3>
            <div className="add-friend-container">
              <input
                type="text"
                value={newFriend}
                onChange={(e) => setNewFriend(e.target.value)}
                placeholder="친구 아이디 입력"
                onKeyPress={handleFriendKeyPress}
              />
              <button
                onClick={handleAddFriend}
                disabled={addingFriend}
                className="add-friend-button"
              >
                {addingFriend ? '추가 중...' : '친구 추가'}
              </button>
            </div>
            {friendError && <p className="error-message">{friendError}</p>}
          </div>
          
          <div className="friends-list">
            {friends.length === 0 ? (
              <p className="no-friends">친구가 없습니다. 친구를 추가해보세요!</p>
            ) : (
              friends.map((friend, index) => (
                <div key={index} className="friend-item">
                  {friend.username}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* 중앙: 채팅방 목록 */}
        <div className="chatrooms-panel">
          <div className="chatrooms-header">
            <div className="chatrooms-title-section">
              <h3>채팅방 목록</h3>
              <button 
                className="refresh-button" 
                onClick={() => fetchChatRooms(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? '새로고침 중...' : '새로고침'}
              </button>
            </div>
            <button 
              className="create-room-button" 
              onClick={() => setShowCreateRoom(!showCreateRoom)}
            >
              {showCreateRoom ? '취소' : '채팅방 생성'}
            </button>
            
            {showCreateRoom && (
              <div className="create-room-form">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="채팅방 이름"
                  className="create-room-input"
                />
                
                <div className="invite-users">
                  <div className="invite-input-container">
                    <input
                      type="text"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="초대할 사용자"
                      className="invite-input"
                    />
                    <button 
                      onClick={addUserToInvite}
                      className="add-user-button"
                    >
                      추가
                    </button>
                  </div>
                  
                  <div className="invited-users">
                    {inviteUsernames.map(user => (
                      <div key={user} className="invited-user">
                        {user}
                        <button 
                          onClick={() => removeUserFromInvite(user)}
                          className="remove-user-button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={createChatRoom}
                  className="create-button"
                  disabled={!newRoomName.trim()}
                >
                  채팅방 생성
                </button>
              </div>
            )}
          </div>
          
          <div className="chatrooms-list">
            {/* 채팅방 목록 */}
            <div 
              className="chatRoomContainer" 
              style={{ 
                height: '100%', 
                overflowY: 'auto', 
                position: 'relative',
                paddingBottom: '60px' 
              }}
            >
              {
                !Array.isArray(chatRooms) || chatRooms.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    color: '#888' 
                  }}>
                    채팅방이 없습니다.
                  </div>
                ) : (
                  Array.isArray(chatRooms) && chatRooms.map((chatRoom) => (
                    chatRoom && chatRoom.id ? (
                      <div 
                        key={chatRoom.id} 
                        className={`chatroom-item ${selectedChatRoom?.id === chatRoom.id ? 'selected' : ''}`}
                        onClick={() => selectChatRoom(chatRoom)}
                      >
                        <div className="chatroom-name">{chatRoom.name || '이름 없는 채팅방'}</div>
                        <div className="chatroom-participants">
                          참여자 {chatRoom.participants_count || 0}명
                          {allRoomParticipants[chatRoom.id] && Array.isArray(allRoomParticipants[chatRoom.id]) && (
                            <span className="participants-list">
                              : {allRoomParticipants[chatRoom.id]
                                .map(p => p.username)
                                .slice(0, 3)
                                .join(', ')}
                              {allRoomParticipants[chatRoom.id].length > 3 && ' 외 ' + (allRoomParticipants[chatRoom.id].length - 3) + '명'}
                            </span>
                          )}
                        </div>
                        {chatRoom.last_message && (
                          <div className="chatroom-last-message">
                            <span className="message-preview">{chatRoom.last_message}</span>
                            <span className="message-time">{chatRoom.last_message_time ? formatTimestamp(chatRoom.last_message_time) : ''}</span>
                          </div>
                        )}
                      </div>
                    ) : null
                  ))
                )}
              </div>
          </div>
        </div>
        
        {/* 우측: 채팅방 */}
        <div className="chat-panel">
          {selectedChatRoom ? (
            <>
              <div className="chat-panel-header">
                <h3>{selectedChatRoom.name}</h3>
                {selectedChatRoom.is_admin && (
                  <button className="room-settings-button">
                    설정
                  </button>
                )}
              </div>
              
              <div className="messages" ref={messagesContainerRef}>
                {loadingMessages && page > 1 && (
                  <div className="loading-more-messages">
                    메시지를 불러오는 중...
                  </div>
                )}
                
                <div className="debug-info" style={{ padding: '10px', background: '#f0f0f0', margin: '10px 0', fontSize: '12px' }}>
                  <div>메시지 개수: {messages.length}</div>
                  <div>선택된 채팅방: {selectedChatRoom?.name || '없음'} (ID: {selectedChatRoom?.id || '없음'})</div>
                  <div>WebSocket 상태: {socket?.readyState === WebSocket.OPEN ? '연결됨' : '연결안됨'}</div>
                </div>
                
                {messages.length === 0 ? (
                  <div className="no-messages">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</div>
                ) : (
                  messages
                    .filter(msg => {
                      // 내용이 없거나 빈 메시지 필터링
                      const isEmpty = !msg.content || 
                                     msg.content === '(내용 없음)' || 
                                     msg.content.trim() === '';
                      
                      // 시스템 메시지는 모두 표시, 일반 메시지는 내용이 있는 것만 표시
                      return msg.is_system || !isEmpty;
                    })
                    .map((msg, idx) => (
                    <div 
                      key={msg.id || idx} 
                      className={`
                        message 
                        ${msg.username === username ? 'my-message' : ''} 
                        ${msg.is_system ? 'system-message' : ''}
                      `}
                    >
                      <div className="message-header">
                        <div className="message-username">{msg.username}</div>
                        {!msg.is_system && (msg.username === username || selectedChatRoom?.is_admin) && (
                          <button 
                            className="delete-message-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
                                deleteMessage(msg.id.toString());
                              }
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="message-content">
                        {typeof msg.content === 'string' && msg.content.startsWith('[삭제된 메시지]') ? (
                          <span className="deleted-message">{msg.content}</span>
                        ) : (
                          <span>{msg.content || '(내용 없음)'}</span>
                        )}
                      </div>
                      <div className="message-time">
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="message-input">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="메시지를 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)"
                  rows={1}
                />
                <button onClick={sendMessage}>전송</button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>채팅방을 선택하거나 새로운 채팅방을 만들어보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatRoomComponent 