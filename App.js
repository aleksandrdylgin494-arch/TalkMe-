import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { 
  View, Text, TextInput, Button, Alert, StyleSheet, 
  TouchableOpacity, Image, Switch, ScrollView, SafeAreaView,
  Modal, FlatList, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ============================================
// ЭКРАНЫ АВТОРИЗАЦИИ
// ============================================

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState('email'); // 'email' or 'phone'
  const [loading, setLoading] = useState(false);

  // Настройка reCAPTCHA для телефона
  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {}
      });
    }
  }, []);

  const handleEmailLogin = () => {
    if (!agreed) {
      Alert.alert('Ошибка', 'Необходимо согласие с политикой конфиденциальности');
      return;
    }
    setLoading(true);
    signInWithEmailAndPassword(auth, email, password)
      .catch(error => Alert.alert('Ошибка входа', error.message))
      .finally(() => setLoading(false));
  };

  const handleEmailRegister = () => {
    if (!agreed) {
      Alert.alert('Ошибка', 'Необходимо согласие с политикой конфиденциальности');
      return;
    }
    setLoading(true);
    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        // Создаем профиль в Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: email,
          displayName: 'Пользователь',
          status: 'Статус',
          avatar: '',
          balance: 0,
          giftCount: 0,
          level: 1,
          exp: 0,
          role: 'user',
          createdAt: serverTimestamp(),
          privacy: {
            phone: 'contacts',
            photo: 'all',
            messages: 'all',
            birthday: 'contacts'
          },
          settings: {
            notifications: true,
            sound: true,
            vibration: true,
            theme: 'auto',
            language: 'ru'
          }
        });
      })
      .catch(error => Alert.alert('Ошибка регистрации', error.message))
      .finally(() => setLoading(false));
  };

  const handleSendPhoneCode = async () => {
    if (!agreed) {
      Alert.alert('Ошибка', 'Необходимо согласие с политикой конфиденциальности');
      return;
    }
    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setVerificationId(confirmation.verificationId);
      Alert.alert('Код отправлен', 'Проверь SMS');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
    setLoading(false);
  };

  const handleVerifyPhoneCode = async () => {
    setLoading(true);
    try {
      const credential = firebase.auth.PhoneAuthProvider.credential(verificationId, code);
      await auth.signInWithCredential(credential);
    } catch (error) {
      Alert.alert('Ошибка', 'Неверный код');
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>TalkMe</Text>
      
      <View style={styles.tabSelector}>
        <TouchableOpacity 
          style={[styles.tab, mode === 'email' && styles.activeTab]} 
          onPress={() => setMode('email')}
        >
          <Text>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, mode === 'phone' && styles.activeTab]} 
          onPress={() => setMode('phone')}
        >
          <Text>Телефон</Text>
        </TouchableOpacity>
      </View>

      {mode === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View style={styles.buttonContainer}>
            <Button title="Войти" onPress={handleEmailLogin} disabled={loading} />
            <Button title="Регистрация" onPress={handleEmailRegister} disabled={loading} />
          </View>
        </>
      ) : (
        <>
          {!verificationId ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="+7 999 123 45 67"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Button title="Отправить код" onPress={handleSendPhoneCode} disabled={loading} />
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Код из SMS"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
              <Button title="Подтвердить" onPress={handleVerifyPhoneCode} disabled={loading} />
            </>
          )}
        </>
      )}

      <View style={styles.checkboxContainer}>
        <TouchableOpacity onPress={() => setAgreed(!agreed)}>
          <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={24} color="#0088cc" />
        </TouchableOpacity>
        <Text style={styles.label}>Соглашаюсь с политикой конфиденциальности</Text>
      </View>

      <View id="recaptcha-container" />
      
      {loading && <ActivityIndicator size="large" color="#0088cc" />}
    </ScrollView>
  );
      }
// ============================================
// КОМПОНЕНТЫ ЧАТОВ
// ============================================

function ChatsScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = [];
      snapshot.forEach((doc) => {
        chatsData.push({ id: doc.id, ...doc.data() });
      });
      setChats(chatsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const openChat = (chatId, chatName) => {
    navigation.navigate('Chat', { chatId, chatName });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0088cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Чаты</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewChat')}>
          <Ionicons name="create-outline" size={24} color="#0088cc" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item.id, item.name)}>
            <Image 
              source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} 
              style={styles.chatAvatar} 
            />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage || 'Нет сообщений'}
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Нет чатов. Начни общение!</Text>
        }
      />
    </View>
  );
}

function ChatScreen({ route, navigation }) {
  const { chatId, chatName } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
    });

    return unsubscribe;
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: inputText,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        type: 'text'
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: inputText,
        lastMessageTime: serverTimestamp()
      });

      setInputText('');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0088cc" />
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle}>{chatName}</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="#0088cc" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.senderId === user.uid ? styles.myMessage : styles.otherMessage
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={styles.messagesList}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Сообщение..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#0088cc" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NewChatScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), where('uid', '!=', user.uid));
      const snapshot = await getDocs(q);
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
    };
    fetchUsers();
  }, []);

  const createChat = async (otherUser) => {
    try {
      const chatRef = await addDoc(collection(db, 'chats'), {
        name: otherUser.displayName,
        avatar: otherUser.avatar,
        participants: [user.uid, otherUser.id],
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        unreadCount: 0,
        type: 'private'
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0088cc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новый чат</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Поиск по имени или email"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userItem} onPress={() => createChat(item)}>
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} style={styles.userAvatar} />
            <View>
              <Text style={styles.userName}>{item.displayName}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ============================================
// КОНТАКТЫ
// ============================================

function ContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    const fetchContacts = async () => {
      const q = query(collection(db, 'users'), where('uid', '!=', user.uid));
      const snapshot = await getDocs(q);
      const contactsData = [];
      snapshot.forEach((doc) => {
        contactsData.push({ id: doc.id, ...doc.data() });
      });
      setContacts(contactsData);
    };
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(c => 
    c.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Контакты</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Поиск"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.contactItem}>
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} style={styles.contactAvatar} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.displayName}</Text>
              <Text style={styles.contactStatus}>{item.status || 'Статус'}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ============================================
// ПУБЛИКАЦИИ (ИСТОРИИ)
// ============================================

function PostsScreen() {
  const [posts, setPosts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [privacy, setPrivacy] = useState('all');
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = [];
      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() });
      });
      setPosts(postsData);
    });
    return unsubscribe;
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нужно разрешение', 'Разреши доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setPostImage(result.assets[0].uri);
    }
  };

  const createPost = async () => {
    try {
      let imageUrl = '';
      if (postImage) {
        const response = await fetch(postImage);
        const blob = await response.blob();
        const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        userAvatar: user.photoURL || '',
        userName: user.displayName || 'Пользователь',
        text: postText,
        image: imageUrl,
        privacy: privacy,
        timestamp: serverTimestamp(),
        likes: []
      });

      setPostText('');
      setPostImage(null);
      setShowCreateModal(false);
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Публикации</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle-outline" size={28} color="#0088cc" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Image source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }} style={styles.postAvatar} />
              <Text style={styles.postUserName}>{item.userName}</Text>
            </View>
            {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.postImage} />
            ) : null}
          </View>
        )}
      />

      <Modal visible={showCreateModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={28} color="#0088cc" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Новая публикация</Text>
            <TouchableOpacity onPress={createPost}>
              <Ionicons name="checkmark" size={28} color="#0088cc" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.postInput}
            placeholder="Что у тебя нового?"
            value={postText}
            onChangeText={setPostText}
            multiline
          />

          <TouchableOpacity onPress={pickImage} style={styles.addImageButton}>
            <Ionicons name="image-outline" size={24} color="#0088cc" />
            <Text>Добавить фото</Text>
          </TouchableOpacity>

          {postImage && (
            <Image source={{ uri: postImage }} style={styles.previewImage} />
          )}

          <View style={styles.privacySelector}>
            <Text>Кому видно:</Text>
            <TouchableOpacity onPress={() => setPrivacy('all')}>
              <Text style={privacy === 'all' ? styles.activePrivacy : styles.privacyOption}>Всем</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrivacy('friends')}>
              <Text style={privacy === 'friends' ? styles.activePrivacy : styles.privacyOption}>Друзьям</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrivacy('none')}>
              <Text style={privacy === 'none' ? styles.activePrivacy : styles.privacyOption}>Только я</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
              }
// ============================================
// МАГАЗИН ПОДАРКОВ (ДАРИУМ)
// ============================================

const GIFT_RARITIES = [
  { name: 'Обычный', color: '#808080', multiplier: 1 },
  { name: 'Необычный', color: '#00ff00', multiplier: 2 },
  { name: 'Редкий', color: '#0000ff', multiplier: 5 },
  { name: 'Очень редкий', color: '#800080', multiplier: 10 },
  { name: 'Легендарный', color: '#ffa500', multiplier: 20 },
  { name: 'Мифический', color: '#ff0000', multiplier: 50 },
  { name: 'Божественный', color: '#ffd700', multiplier: 100 }
];

function GiftShopScreen() {
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [users, setUsers] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    // Загружаем подарки
    const fetchGifts = async () => {
      const q = query(collection(db, 'gifts'));
      const snapshot = await getDocs(q);
      const giftsData = [];
      snapshot.forEach((doc) => {
        giftsData.push({ id: doc.id, ...doc.data() });
      });
      setGifts(giftsData);
    };

    // Загружаем пользователей для дарения
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), where('uid', '!=', user.uid));
      const snapshot = await getDocs(q);
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
    };

    fetchGifts();
    fetchUsers();
  }, []);

  const buyGift = async () => {
    if (!selectedGift) return;

    try {
      // Проверяем баланс
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData.balance < selectedGift.price) {
        Alert.alert('Ошибка', 'Недостаточно средств');
        return;
      }

      // Списываем баланс
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(-selectedGift.price),
        giftCount: increment(1),
        exp: increment(30 * GIFT_RARITIES.find(r => r.name === selectedGift.rarity)?.multiplier || 30)
      });

      // Добавляем подарок в коллекцию пользователя
      await addDoc(collection(db, 'userGifts', user.uid, 'gifts'), {
        giftId: selectedGift.id,
        name: selectedGift.name,
        rarity: selectedGift.rarity,
        image: selectedGift.image,
        receivedAt: serverTimestamp(),
        isAnimated: selectedGift.isAnimated
      });

      Alert.alert('Успех', 'Подарок куплен!');
      setShowBuyModal(false);
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const sendGift = async () => {
    if (!selectedGift || !recipient) return;

    try {
      // Проверяем баланс
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData.balance < selectedGift.price) {
        Alert.alert('Ошибка', 'Недостаточно средств');
        return;
      }

      // Списываем баланс у дарителя
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(-selectedGift.price),
        exp: increment(50 * GIFT_RARITIES.find(r => r.name === selectedGift.rarity)?.multiplier || 50)
      });

      // Добавляем подарок получателю
      await addDoc(collection(db, 'userGifts', recipient, 'gifts'), {
        giftId: selectedGift.id,
        name: selectedGift.name,
        rarity: selectedGift.rarity,
        image: selectedGift.image,
        receivedAt: serverTimestamp(),
        isAnimated: selectedGift.isAnimated,
        from: user.uid,
        fromName: user.displayName
      });

      // Начисляем опыт получателю
      await updateDoc(doc(db, 'users', recipient), {
        exp: increment(5 * GIFT_RARITIES.find(r => r.name === selectedGift.rarity)?.multiplier || 5)
      });

      Alert.alert('Успех', 'Подарок отправлен!');
      setShowBuyModal(false);
      setRecipient('');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const getRarityColor = (rarity) => {
    const found = GIFT_RARITIES.find(r => r.name === rarity);
    return found ? found.color : '#808080';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Магазин подарков</Text>
      </View>

      <FlatList
        data={gifts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.giftCard}
            onPress={() => {
              setSelectedGift(item);
              setShowBuyModal(true);
            }}
          >
            <View style={[styles.giftImageContainer, { backgroundColor: getRarityColor(item.rarity) + '20' }]}>
              {item.isAnimated ? (
                <Ionicons name="gift" size={40} color={getRarityColor(item.rarity)} />
              ) : (
                <Ionicons name="gift-outline" size={40} color={getRarityColor(item.rarity)} />
              )}
            </View>
            <Text style={styles.giftName}>{item.name}</Text>
            <Text style={[styles.giftRarity, { color: getRarityColor(item.rarity) }]}>{item.rarity}</Text>
            <Text style={styles.giftPrice}>{item.price} TON</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.giftsGrid}
      />

      <Modal visible={showBuyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedGift?.name}</Text>
            <Text>Редкость: {selectedGift?.rarity}</Text>
            <Text>Цена: {selectedGift?.price} TON</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={buyGift}>
                <Text>Купить себе</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalButton} onPress={() => setRecipient('select')}>
                <Text>Подарить</Text>
              </TouchableOpacity>

              {recipient === 'select' && (
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.userSelectItem}
                      onPress={() => {
                        setRecipient(item.id);
                        sendGift();
                      }}
                    >
                      <Image source={{ uri: item.avatar || 'https://via.placeholder.com/30' }} style={styles.userSelectAvatar} />
                      <Text>{item.displayName}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.userList}
                />
              )}
            </View>

            <TouchableOpacity onPress={() => setShowBuyModal(false)}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
// ============================================

function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [avatar, setAvatar] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      const docRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
          setDisplayName(doc.data().displayName || '');
          setStatus(doc.data().status || '');
          setAvatar(doc.data().avatar || '');
        }
      });
      return unsubscribe;
    };

    const fetchGifts = async () => {
      const q = query(collection(db, 'userGifts', user.uid, 'gifts'), orderBy('receivedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const giftsData = [];
        snapshot.forEach((doc) => {
          giftsData.push({ id: doc.id, ...doc.data() });
        });
        setGifts(giftsData.slice(0, 8)); // Показываем последние 8 подарков
      });
      return unsubscribe;
    };

    fetchUserData();
    fetchGifts();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нужно разрешение', 'Разреши доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
      
      // Загружаем в Storage
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), {
        avatar: url
      });
    }
  };

  const saveProfile = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName,
      status
    });
    setEditing(false);
  };

  if (!userData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0088cc" />
      </View>
    );
  }

  const nextLevelExp = 300;
  const expProgress = (userData.exp % nextLevelExp) / nextLevelExp * 100;

  return (
    <ScrollView style={styles.profileContainer}>
      <View style={styles.avatarSection}>
        <Image source={{ uri: avatar || 'https://via.placeholder.com/100' }} style={styles.avatar} />
        <TouchableOpacity onPress={pickImage} style={styles.changeAvatarButton}>
          <Ionicons name="camera" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {editing ? (
        <View style={styles.editSection}>
          <TextInput
            style={styles.input}
            placeholder="Имя"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            placeholder="Статус"
            value={status}
            onChangeText={setStatus}
          />
          <View style={styles.editButtons}>
            <Button title="Сохранить" onPress={saveProfile} />
            <Button title="Отмена" onPress={() => setEditing(false)} color="gray" />
          </View>
        </View>
      ) : (
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{userData.displayName}</Text>
          <Text style={styles.status}>{userData.status || 'Статус'}</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Редактировать профиль</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{userData.balance || 0}</Text>
          <Text style={styles.statLabel}>TON</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{userData.giftCount || 0}</Text>
          <Text style={styles.statLabel}>Подарков</Text>
        </View>
      </View>

      <View style={styles.levelCard}>
        <Text style={styles.levelTitle}>Уровень {userData.level || 1}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${expProgress}%` }]} />
        </View>
        <Text style={styles.expText}>{userData.exp || 0}/{nextLevelExp * (userData.level || 1)} опыта</Text>
      </View>

      <View style={styles.giftsSection}>
        <Text style={styles.sectionTitle}>Коллекция подарков</Text>
        <View style={styles.giftsGrid}>
          {gifts.map((gift) => (
            <TouchableOpacity
              key={gift.id}
              style={styles.giftItem}
              onPress={() => {
                setSelectedGift(gift);
                setShowGiftModal(true);
              }}
            >
              {gift.isAnimated ? (
                <Ionicons name="gift" size={30} color={getRarityColor(gift.rarity)} />
              ) : (
                <Ionicons name="gift-outline" size={30} color={getRarityColor(gift.rarity)} />
              )}
            </TouchableOpacity>
          ))}
          {[...Array(8 - gifts.length)].map((_, i) => (
            <View key={i} style={styles.giftPlaceholder} />
          ))}
        </View>
      </View>

      <Modal visible={showGiftModal} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedGift?.name}</Text>
            <Text>Редкость: {selectedGift?.rarity}</Text>
            <Text>Получен: {selectedGift?.receivedAt?.toDate().toLocaleDateString()}</Text>
            {selectedGift?.from && (
              <Text>От: {selectedGift.fromName}</Text>
            )}
            <TouchableOpacity onPress={() => setShowGiftModal(false)}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Button title="Выйти" onPress={() => signOut(auth)} />
    </ScrollView>
  );
        }
// ============================================
// НАСТРОЙКИ (9 РАЗДЕЛОВ)
// ============================================

function SettingsScreen() {
  const [settings, setSettings] = useState({
    account: {},
    chatSettings: {},
    privacy: {},
    notifications: {},
    dataStorage: {},
    folders: {},
    devices: [],
    batterySaver: false,
    language: 'ru'
  });
  const [expandedSection, setExpandedSection] = useState(null);
  const [userData, setUserData] = useState(null);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUserData(data);
          setSettings({
            account: {
              phone: data.phone || '',
              email: data.email || '',
              username: data.displayName || '',
              bio: data.status || '',
              birthday: data.birthday || '',
              birthdayPrivacy: data.privacy?.birthday || 'contacts'
            },
            chatSettings: {
              wallpaper: data.chatSettings?.wallpaper || '',
              nightMode: data.chatSettings?.nightMode || false,
              animations: data.chatSettings?.animations || true,
              fontSize: data.chatSettings?.fontSize || 16,
              nameColor: data.chatSettings?.nameColor || '#000000',
              bubbleCorners: data.chatSettings?.bubbleCorners || 12
            },
            privacy: data.privacy || {
              phone: 'contacts',
              photo: 'all',
              messages: 'all',
              birthday: 'contacts',
              lastSeen: 'all'
            },
            notifications: data.notifications || {
              sound: true,
              vibration: true,
              count: true,
              preview: true,
              groups: true,
              channels: true,
              calls: true,
              repeat: 0,
              background: true
            },
            dataStorage: {
              autoDownload: data.dataStorage?.autoDownload || 'wifi',
              saveToGallery: data.dataStorage?.saveToGallery || false,
              cacheSize: data.dataStorage?.cacheSize || 0
            },
            folders: data.folders || [],
            devices: data.devices || [],
            batterySaver: data.batterySaver || false,
            language: data.language || 'ru'
          });
        }
      });
      return unsubscribe;
    };
    fetchSettings();
  }, []);

  const updateSetting = async (section, key, value) => {
    try {
      const updatePath = {};
      if (section === 'account') {
        if (key === 'username') updatePath['displayName'] = value;
        else if (key === 'bio') updatePath['status'] = value;
        else if (key === 'birthday') updatePath['birthday'] = value;
        else if (key === 'birthdayPrivacy') updatePath['privacy.birthday'] = value;
      } else if (section === 'chatSettings') {
        updatePath[`chatSettings.${key}`] = value;
      } else if (section === 'privacy') {
        updatePath[`privacy.${key}`] = value;
      } else if (section === 'notifications') {
        updatePath[`notifications.${key}`] = value;
      } else if (section === 'dataStorage') {
        updatePath[`dataStorage.${key}`] = value;
      } else if (section === 'batterySaver') {
        updatePath['batterySaver'] = value;
      } else if (section === 'language') {
        updatePath['language'] = value;
      }

      await updateDoc(doc(db, 'users', user.uid), updatePath);

      setSettings(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value
        }
      }));
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const renderSection = (title, icon, content) => (
    <View style={styles.settingsSection}>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={() => setExpandedSection(expandedSection === title ? null : title)}
      >
        <Ionicons name={icon} size={24} color="#0088cc" />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons 
          name={expandedSection === title ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#666"
        />
      </TouchableOpacity>
      {expandedSection === title && (
        <View style={styles.sectionContent}>
          {content}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.settingsContainer}>
      <Text style={styles.settingsMainTitle}>Настройки</Text>

      {/* 1. Аккаунт */}
      {renderSection('Аккаунт', 'person-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Номер телефона</Text>
            <Text style={styles.settingValue}>{settings.account.phone || 'Не указан'}</Text>
          </View>
          <View style={styles.settingItem}>
            <Text>Email</Text>
            <Text style={styles.settingValue}>{settings.account.email || 'Не указан'}</Text>
          </View>
          <View style={styles.settingItem}>
            <Text>Имя пользователя</Text>
            <TextInput
              style={styles.settingInput}
              value={settings.account.username}
              onChangeText={(val) => updateSetting('account', 'username', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>О себе</Text>
            <TextInput
              style={styles.settingInput}
              value={settings.account.bio}
              onChangeText={(val) => updateSetting('account', 'bio', val)}
              multiline
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Дата рождения</Text>
            <TextInput
              style={styles.settingInput}
              value={settings.account.birthday}
              onChangeText={(val) => updateSetting('account', 'birthday', val)}
              placeholder="ДД.ММ"
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Кто видит дату рождения</Text>
            <Picker
              selectedValue={settings.account.birthdayPrivacy}
              onValueChange={(val) => updateSetting('account', 'birthdayPrivacy', val)}
              style={styles.picker}
            >
              <Picker.Item label="Все" value="all" />
              <Picker.Item label="Только друзья" value="contacts" />
              <Picker.Item label="Только я" value="none" />
            </Picker>
          </View>
        </View>
      ))}

      {/* 2. Настройки чатов */}
      {renderSection('Настройки чатов', 'chatbubbles-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Обои</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.settingLink}>Выбрать</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.settingItem}>
            <Text>Ночной режим</Text>
            <Switch
              value={settings.chatSettings.nightMode}
              onValueChange={(val) => updateSetting('chatSettings', 'nightMode', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Анимации</Text>
            <Switch
              value={settings.chatSettings.animations}
              onValueChange={(val) => updateSetting('chatSettings', 'animations', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Размер текста</Text>
            <Slider
              value={settings.chatSettings.fontSize}
              onValueChange={(val) => updateSetting('chatSettings', 'fontSize', val)}
              minimumValue={12}
              maximumValue={24}
              step={1}
            />
            <Text>{settings.chatSettings.fontSize}px</Text>
          </View>
          <View style={styles.settingItem}>
            <Text>Цвет имени</Text>
            <TouchableOpacity>
              <Text style={styles.settingLink}>Выбрать цвет</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.settingItem}>
            <Text>Углы блоков</Text>
            <Slider
              value={settings.chatSettings.bubbleCorners}
              onValueChange={(val) => updateSetting('chatSettings', 'bubbleCorners', val)}
              minimumValue={0}
              maximumValue={30}
              step={2}
            />
            <Text>{settings.chatSettings.bubbleCorners}px</Text>
          </View>
        </View>
      ))}

      {/* 3. Конфиденциальность */}
      {renderSection('Конфиденциальность', 'lock-closed-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Кто видит номер</Text>
            <Picker
              selectedValue={settings.privacy.phone}
              onValueChange={(val) => updateSetting('privacy', 'phone', val)}
              style={styles.picker}
            >
              <Picker.Item label="Все" value="all" />
              <Picker.Item label="Только контакты" value="contacts" />
              <Picker.Item label="Никто" value="none" />
            </Picker>
          </View>
          <View style={styles.settingItem}>
            <Text>Кто видит фото</Text>
            <Picker
              selectedValue={settings.privacy.photo}
              onValueChange={(val) => updateSetting('privacy', 'photo', val)}
              style={styles.picker}
            >
              <Picker.Item label="Все" value="all" />
              <Picker.Item label="Только контакты" value="contacts" />
              <Picker.Item label="Никто" value="none" />
            </Picker>
          </View>
          <View style={styles.settingItem}>
            <Text>Кто может писать</Text>
            <Picker
              selectedValue={settings.privacy.messages}
              onValueChange={(val) => updateSetting('privacy', 'messages', val)}
              style={styles.picker}
            >
              <Picker.Item label="Все" value="all" />
              <Picker.Item label="Только контакты" value="contacts" />
              <Picker.Item label="Никто" value="none" />
            </Picker>
          </View>
          <View style={styles.settingItem}>
            <Text>Кто видит время захода</Text>
            <Picker
              selectedValue={settings.privacy.lastSeen}
              onValueChange={(val) => updateSetting('privacy', 'lastSeen', val)}
              style={styles.picker}
            >
              <Picker.Item label="Все" value="all" />
              <Picker.Item label="Только контакты" value="contacts" />
              <Picker.Item label="Никто" value="none" />
            </Picker>
          </View>
        </View>
      ))}

      {/* 4. Уведомления */}
      {renderSection('Уведомления', 'notifications-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Звук</Text>
            <Switch
              value={settings.notifications.sound}
              onValueChange={(val) => updateSetting('notifications', 'sound', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Вибрация</Text>
            <Switch
              value={settings.notifications.vibration}
              onValueChange={(val) => updateSetting('notifications', 'vibration', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Счётчик сообщений</Text>
            <Switch
              value={settings.notifications.count}
              onValueChange={(val) => updateSetting('notifications', 'count', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Предпросмотр</Text>
            <Switch
              value={settings.notifications.preview}
              onValueChange={(val) => updateSetting('notifications', 'preview', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Уведомления в группах</Text>
            <Switch
              value={settings.notifications.groups}
              onValueChange={(val) => updateSetting('notifications', 'groups', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Уведомления в каналах</Text>
            <Switch
              value={settings.notifications.channels}
              onValueChange={(val) => updateSetting('notifications', 'channels', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Звонки</Text>
            <Switch
              value={settings.notifications.calls}
              onValueChange={(val) => updateSetting('notifications', 'calls', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Повтор уведомлений</Text>
            <Picker
              selectedValue={settings.notifications.repeat}
              onValueChange={(val) => updateSetting('notifications', 'repeat', val)}
              style={styles.picker}
            >
              <Picker.Item label="Никогда" value={0} />
              <Picker.Item label="1 раз" value={1} />
              <Picker.Item label="2 раза" value={2} />
              <Picker.Item label="3 раза" value={3} />
            </Picker>
          </View>
          <View style={styles.settingItem}>
            <Text>Фоновые уведомления</Text>
            <Switch
              value={settings.notifications.background}
              onValueChange={(val) => updateSetting('notifications', 'background', val)}
            />
          </View>
        </View>
      ))}

      {/* 5. Данные и память */}
      {renderSection('Данные и память', 'server-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Автозагрузка медиа</Text>
            <Picker
              selectedValue={settings.dataStorage.autoDownload}
              onValueChange={(val) => updateSetting('dataStorage', 'autoDownload', val)}
              style={styles.picker}
            >
              <Picker.Item label="Только Wi-Fi" value="wifi" />
              <Picker.Item label="Всегда" value="always" />
              <Picker.Item label="Никогда" value="never" />
            </Picker>
          </View>
          <View style={styles.settingItem}>
            <Text>Сохранять в галерею</Text>
            <Switch
              value={settings.dataStorage.saveToGallery}
              onValueChange={(val) => updateSetting('dataStorage', 'saveToGallery', val)}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>Размер кеша</Text>
            <Text>{settings.dataStorage.cacheSize} MB</Text>
            <TouchableOpacity>
              <Text style={styles.settingLink}>Очистить</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* 6. Папки с чатами */}
      {renderSection('Папки с чатами', 'folder-outline', (
        <View>
          {settings.folders.length === 0 ? (
            <Text>Нет папок</Text>
          ) : (
            settings.folders.map((folder, index) => (
              <View key={index} style={styles.settingItem}>
                <Text>{folder.name}</Text>
                <Text>{folder.chats?.length || 0} чатов</Text>
              </View>
            ))
          )}
          <TouchableOpacity>
            <Text style={styles.settingLink}>Создать папку</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* 7. Устройства */}
      {renderSection('Устройства', 'phone-portrait-outline', (
        <View>
          {settings.devices.map((device, index) => (
            <View key={index} style={styles.settingItem}>
              <Text>{device.name}</Text>
              <Text>{device.lastActive}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* 8. Энергосбережение */}
      {renderSection('Энергосбережение', 'battery-half-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Экономия при низком заряде</Text>
            <Switch
              value={settings.batterySaver}
              onValueChange={(val) => updateSetting('batterySaver', null, val)}
            />
          </View>
        </View>
      ))}

      {/* 9. Язык */}
      {renderSection('Язык', 'language-outline', (
        <View>
          <View style={styles.settingItem}>
            <Text>Русский</Text>
            <RadioButton
              value={settings.language === 'ru'}
              onPress={() => updateSetting('language', null, 'ru')}
            />
          </View>
          <View style={styles.settingItem}>
            <Text>English</Text>
            <RadioButton
              value={settings.language === 'en'}
              onPress={() => updateSetting('language', null, 'en')}
            />
          </View>
        </View>
      ))}

      {/* Политика и помощь */}
      <View style={styles.settingsFooter}>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Помощь</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Возможности TalkMe</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Политика конфиденциальности</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Задать вопрос</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
                }
// ============================================
// АДМИН-ПАНЕЛЬ (только для разработчика)
// ============================================

function AdminScreen() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    totalGifts: 0,
    totalChats: 0,
    activeToday: 0
  });
  const [giftData, setGiftData] = useState({
    name: '',
    price: '',
    rarity: 'Обычный',
    isAnimated: false,
    image: ''
  });
  const [complaints, setComplaints] = useState([]);
  const [showComplaints, setShowComplaints] = useState(false);
  const [showAddGift, setShowAddGift] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [adminRole, setAdminRole] = useState('user');
  
  const user = auth.currentUser;
  const isDeveloper = user?.email === 'aleksandrdyglin494@gmail.com';

  useEffect(() => {
    if (!isDeveloper) return;

    // Загружаем пользователей
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
      setFilteredUsers(usersData);
      setStats(prev => ({ ...prev, totalUsers: usersData.length }));
    });

    // Загружаем жалобы
    const unsubscribeComplaints = onSnapshot(collection(db, 'complaints'), (snapshot) => {
      const complaintsData = [];
      snapshot.forEach((doc) => {
        complaintsData.push({ id: doc.id, ...doc.data() });
      });
      setComplaints(complaintsData);
    });

    // Загружаем транзакции
    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const transactionsData = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsData);
      const totalGifts = transactionsData.filter(t => t.type === 'gift_purchase').length;
      setStats(prev => ({ ...prev, totalGifts }));
    });

    // Считаем сообщения
    const countMessages = async () => {
      const chatsSnapshot = await getDocs(collection(db, 'chats'));
      let total = 0;
      for (const chat of chatsSnapshot.docs) {
        const messagesSnapshot = await getDocs(collection(db, 'chats', chat.id, 'messages'));
        total += messagesSnapshot.size;
      }
      setStats(prev => ({ ...prev, totalMessages: total, totalChats: chatsSnapshot.size }));
    };
    countMessages();

    return () => {
      unsubscribeUsers();
      unsubscribeComplaints();
      unsubscribeTransactions();
    };
  }, [isDeveloper]);

  // Поиск пользователей
  useEffect(() => {
    const filtered = users.filter(u => 
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleBan = async (userId, currentBanStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        banned: !currentBanStatus
      });
      Alert.alert('Успех', currentBanStatus ? 'Пользователь разбанен' : 'Пользователь забанен');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      Alert.alert('Успех', `Роль изменена на ${newRole}`);
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleAddBalance = async (userId, amount) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        balance: increment(amount)
      });
      Alert.alert('Успех', `Баланс пополнен на ${amount} TON`);
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleAddGift = async () => {
    try {
      await addDoc(collection(db, 'gifts'), {
        ...giftData,
        price: parseFloat(giftData.price),
        createdAt: serverTimestamp()
      });
      Alert.alert('Успех', 'Подарок добавлен');
      setShowAddGift(false);
      setGiftData({
        name: '',
        price: '',
        rarity: 'Обычный',
        isAnimated: false,
        image: ''
      });
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const handleComplaint = async (complaintId, action, targetId) => {
    try {
      if (action === 'block') {
        // Блокируем группу/канал
        await updateDoc(doc(db, 'chats', targetId), {
          blocked: true,
          blockedMessage: 'Эта группа/канал заблокированы за нарушения'
        });
        
        // Кикаем всех пользователей
        const chatDoc = await getDoc(doc(db, 'chats', targetId));
        const participants = chatDoc.data()?.participants || [];
        for (const participant of participants) {
          await updateDoc(doc(db, 'chats', targetId), {
            participants: arrayRemove(participant)
          });
        }
      } else if (action === 'delete') {
        // Удаляем группу/канал
        await deleteDoc(doc(db, 'chats', targetId));
      }
      
      // Удаляем жалобу
      await deleteDoc(doc(db, 'complaints', complaintId));
      
      Alert.alert('Успех', 'Жалоба обработана');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  if (!isDeveloper) {
    return (
      <View style={styles.center}>
        <Text>У вас нет доступа к админ-панели</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.adminContainer}>
      <Text style={styles.adminTitle}>Админ-панель</Text>

      {/* Статистика */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text>Пользователей</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalMessages}</Text>
          <Text>Сообщений</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalGifts}</Text>
          <Text>Подарков</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalChats}</Text>
          <Text>Чатов</Text>
        </View>
      </View>

      {/* Поиск пользователей */}
      <TextInput
        style={styles.adminSearch}
        placeholder="Поиск по имени, email, телефону"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Список пользователей */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.adminUserCard}
            onPress={() => {
              setSelectedUser(item);
              setShowUserModal(true);
            }}
          >
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/40' }} style={styles.adminAvatar} />
            <View style={styles.adminUserInfo}>
              <Text style={styles.adminUserName}>{item.displayName}</Text>
              <Text style={styles.adminUserEmail}>{item.email}</Text>
              <View style={styles.adminUserBadges}>
                <Text style={[styles.roleBadge, { backgroundColor: item.role === 'developer' ? '#ffd700' : item.role === 'admin' ? '#0088cc' : '#808080' }]}>
                  {item.role || 'user'}
                </Text>
                {item.banned && <Text style={styles.bannedBadge}>Забанен</Text>}
              </View>
            </View>
          </TouchableOpacity>
        )}
        style={styles.adminUserList}
      />

      {/* Кнопки управления */}
      <View style={styles.adminButtons}>
        <TouchableOpacity style={styles.adminButton} onPress={() => setShowComplaints(true)}>
          <Ionicons name="alert-circle" size={20} color="white" />
          <Text style={styles.adminButtonText}>Жалобы ({complaints.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.adminButton} onPress={() => setShowAddGift(true)}>
          <Ionicons name="gift" size={20} color="white" />
          <Text style={styles.adminButtonText}>Добавить подарок</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.adminButton} onPress={() => setShowTransactions(true)}>
          <Ionicons name="cash" size={20} color="white" />
          <Text style={styles.adminButtonText}>Транзакции</Text>
        </TouchableOpacity>
      </View>

      {/* Модалка управления пользователем */}
      <Modal visible={showUserModal} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedUser?.displayName}</Text>
            
            <View style={styles.userDetail}>
              <Text>Email: {selectedUser?.email}</Text>
              <Text>Телефон: {selectedUser?.phone || 'Не указан'}</Text>
              <Text>Баланс: {selectedUser?.balance} TON</Text>
              <Text>Подарков: {selectedUser?.giftCount}</Text>
              <Text>Уровень: {selectedUser?.level}</Text>
              <Text>Опыт: {selectedUser?.exp}</Text>
            </View>

            <View style={styles.adminActions}>
              <TouchableOpacity 
                style={styles.adminActionButton}
                onPress={() => {
                  handleBan(selectedUser.id, selectedUser.banned);
                  setShowUserModal(false);
                }}
              >
                <Text>{selectedUser?.banned ? 'Разбанить' : 'Забанить'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.adminActionButton}
                onPress={() => {
                  const amount = prompt('Введите сумму TON');
                  if (amount) handleAddBalance(selectedUser.id, parseFloat(amount));
                  setShowUserModal(false);
                }}
              >
                <Text>Пополнить баланс</Text>
              </TouchableOpacity>

              <Picker
                selectedValue={selectedUser?.role || 'user'}
                onValueChange={(val) => {
                  handleChangeRole(selectedUser.id, val);
                  setShowUserModal(false);
                }}
                style={styles.rolePicker}
              >
                <Picker.Item label="Пользователь" value="user" />
                <Picker.Item label="Модератор" value="moderator" />
                <Picker.Item label="Админ" value="admin" />
                <Picker.Item label="Разработчик" value="developer" />
              </Picker>
            </View>

            <TouchableOpacity onPress={() => setShowUserModal(false)}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка жалоб */}
      <Modal visible={showComplaints} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Жалобы</Text>
            
            <FlatList
              data={complaints}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.complaintCard}>
                  <Text>От: {item.userName}</Text>
                  <Text>На: {item.targetName}</Text>
                  <Text>Причина: {item.reason}</Text>
                  <Text>Сообщение: {item.message}</Text>
                  <View style={styles.complaintActions}>
                    <TouchableOpacity 
                      style={styles.complaintButton}
                      onPress={() => handleComplaint(item.id, 'block', item.targetId)}
                    >
                      <Text>Заблокировать</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.complaintButton}
                      onPress={() => handleComplaint(item.id, 'delete', item.targetId)}
                    >
                      <Text>Удалить</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.complaintButton}
                      onPress={() => handleComplaint(item.id, 'ignore', item.targetId)}
                    >
                      <Text>Отклонить</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />

            <TouchableOpacity onPress={() => setShowComplaints(false)}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка добавления подарка */}
      <Modal visible={showAddGift} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Добавить подарок</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Название"
              value={giftData.name}
              onChangeText={(val) => setGiftData({...giftData, name: val})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Цена в TON"
              value={giftData.price}
              onChangeText={(val) => setGiftData({...giftData, price: val})}
              keyboardType="numeric"
            />
            
            <Picker
              selectedValue={giftData.rarity}
              onValueChange={(val) => setGiftData({...giftData, rarity: val})}
              style={styles.picker}
            >
              {GIFT_RARITIES.map(r => (
                <Picker.Item key={r.name} label={r.name} value={r.name} />
              ))}
            </Picker>
            
            <View style={styles.settingItem}>
              <Text>Анимированный</Text>
              <Switch
                value={giftData.isAnimated}
                onValueChange={(val) => setGiftData({...giftData, isAnimated: val})}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddGift}>
                <Text>Добавить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowAddGift(false)}>
                <Text>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка транзакций */}
      <Modal visible={showTransactions} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Транзакции</Text>
            
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.transactionCard}>
                  <Text>Тип: {item.type}</Text>
                  <Text>Сумма: {item.amount} TON</Text>
                  <Text>Пользователь: {item.userName}</Text>
                  <Text>Дата: {item.timestamp?.toDate().toLocaleString()}</Text>
                </View>
              )}
            />

            <TouchableOpacity onPress={() => setShowTransactions(false)}>
              <Text style={styles.closeButton}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
  }
/* ============================================
   ОСНОВНЫЕ СТИЛИ
   ============================================ */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f0f2f5;
}

/* Контейнеры */
.container {
  flex: 1;
  background-color: #fff;
}

.center {
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

/* Заголовки */
.header {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #0088cc;
  border-bottom-width: 1px;
  border-bottom-color: #ddd;
}

.headerTitle {
  font-size: 20px;
  font-weight: bold;
  color: white;
}

/* ============================================
   ЭКРАН ВХОДА
   ============================================ */

.loginContainer {
  flex: 1;
  justify-content: center;
  padding: 20px;
  background-color: #f0f2f5;
}

.title {
  font-size: 32px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 40px;
  color: #0088cc;
}

.input {
  background-color: white;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 10px;
  border-width: 1px;
  border-color: #ddd;
  font-size: 16px;
}

.tabSelector {
  flex-direction: row;
  margin-bottom: 20px;
  border-radius: 10px;
  overflow: hidden;
  border-width: 1px;
  border-color: #0088cc;
}

.tab {
  flex: 1;
  padding: 12px;
  align-items: center;
  background-color: white;
}

.activeTab {
  background-color: #0088cc;
}

.activeTab Text {
  color: white;
}

.checkboxContainer {
  flex-direction: row;
  align-items: center;
  margin: 15px 0;
}

.label {
  margin-left: 8px;
  font-size: 14px;
  color: #333;
}

.buttonContainer {
  flex-direction: row;
  justify-content: space-around;
  margin-top: 10px;
}

/* ============================================
   ЧАТЫ
   ============================================ */

.chatItem {
  flex-direction: row;
  padding: 12px 15px;
  align-items: center;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
}

.chatAvatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 12px;
}

.chatInfo {
  flex: 1;
}

.chatName {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 4px;
}

.lastMessage {
  font-size: 14px;
  color: #666;
}

.unreadBadge {
  background-color: #0088cc;
  border-radius: 12px;
  min-width: 24px;
  height: 24px;
  justify-content: center;
  align-items: center;
  padding: 0 6px;
}

.unreadText {
  color: white;
  font-size: 12px;
  font-weight: bold;
}

/* Экран чата */
.chatHeader {
  flex-direction: row;
  align-items: center;
  padding: 10px 15px;
  background-color: white;
  border-bottom-width: 1px;
  border-bottom-color: #ddd;
}

.chatHeaderTitle {
  flex: 1;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
}

.messagesList {
  padding: 15px;
}

.messageBubble {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 18px;
  margin-bottom: 8px;
}

.myMessage {
  align-self: flex-end;
  background-color: #0088cc;
}

.otherMessage {
  align-self: flex-start;
  background-color: #e5e5ea;
}

.messageText {
  color: #000;
}

.myMessage .messageText {
  color: white;
}

.inputContainer {
  flex-direction: row;
  padding: 10px;
  background-color: white;
  border-top-width: 1px;
  border-top-color: #ddd;
  align-items: center;
}

.messageInput {
  flex: 1;
  background-color: #f0f2f5;
  border-radius: 20px;
  padding: 10px 15px;
  max-height: 100px;
  margin-right: 10px;
}

.sendButton {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #0088cc;
  justify-content: center;
  align-items: center;
}

/* Новый чат */
.searchInput {
  background-color: white;
  padding: 12px 15px;
  border-radius: 20px;
  margin: 10px 15px;
  border-width: 1px;
  border-color: #ddd;
}

.userItem {
  flex-direction: row;
  padding: 12px 15px;
  align-items: center;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
}

.userAvatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 12px;
}

.userName {
  font-size: 16px;
  font-weight: bold;
}

.userEmail {
  font-size: 14px;
  color: #666;
}

/* ============================================
   КОНТАКТЫ
   ============================================ */

.contactItem {
  flex-direction: row;
  padding: 12px 15px;
  align-items: center;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
}

.contactAvatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 12px;
}

.contactInfo {
  flex: 1;
}

.contactName {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 4px;
}

.contactStatus {
  font-size: 14px;
  color: #666;
}

/* ============================================
   ПУБЛИКАЦИИ
   ============================================ */

.postCard {
  background-color: white;
  margin-bottom: 15px;
  padding: 15px;
  border-radius: 10px;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-radius: 5px;
  elevation: 3;
}

.postHeader {
  flex-direction: row;
  align-items: center;
  margin-bottom: 10px;
}

.postAvatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  margin-right: 10px;
}

.postUserName {
  font-size: 16px;
  font-weight: bold;
}

.postText {
  font-size: 15px;
  margin-bottom: 10px;
  line-height: 20px;
}

.postImage {
  width: '100%';
  height: 200px;
  border-radius: 10px;
  margin-top: 10px;
}

/* Модалка создания поста */
.modalContainer {
  flex: 1;
  background-color: white;
  padding: 20px;
}

.modalHeader {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modalTitle {
  font-size: 20px;
  font-weight: bold;
  color: #0088cc;
}

.postInput {
  background-color: #f0f2f5;
  border-radius: 10px;
  padding: 15px;
  min-height: 100px;
  margin-bottom: 15px;
  font-size: 16px;
}

.addImageButton {
  flex-direction: row;
  align-items: center;
  padding: 10px;
  background-color: #f0f2f5;
  border-radius: 10px;
  margin-bottom: 15px;
}

.addImageButton Text {
  margin-left: 10px;
  color: #0088cc;
}

.previewImage {
  width: '100%';
  height: 200px;
  border-radius: 10px;
  margin-bottom: 15px;
}

.privacySelector {
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  margin-top: 15px;
}

.privacyOption {
  padding: 8px 15px;
  border-radius: 20px;
  background-color: #f0f2f5;
}

.activePrivacy {
  padding: 8px 15px;
  border-radius: 20px;
  background-color: #0088cc;
  color: white;
}

/* ============================================
   МАГАЗИН ПОДАРКОВ
   ============================================ */

.giftsGrid {
  padding: 10px;
}

.giftCard {
  flex: 1;
  margin: 8px;
  padding: 15px;
  background-color: white;
  border-radius: 10px;
  align-items: center;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-radius: 5px;
  elevation: 2;
}

.giftImageContainer {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}

.giftName {
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 4px;
}

.giftRarity {
  font-size: 12px;
  margin-bottom: 4px;
}

.giftPrice {
  font-size: 14px;
  font-weight: bold;
  color: #0088cc;
}

/* ============================================
   ПРОФИЛЬ
   ============================================ */

.profileContainer {
  flex: 1;
  background-color: white;
}

.avatarSection {
  align-items: center;
  padding: 30px 20px;
  position: relative;
}

.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50px;
  border-width: 3px;
  border-color: #0088cc;
}

.changeAvatarButton {
  position: absolute;
  bottom: 30px;
  right: '40%';
  background-color: rgba(0,0,0,0.5);
  width: 40px;
  height: 40px;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
}

.profileInfo {
  align-items: center;
  margin-bottom: 20px;
}

.name {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.status {
  font-size: 16px;
  color: #666;
  margin-bottom: 10px;
}

.editLink {
  color: #0088cc;
  font-size: 14px;
}

.editSection {
  padding: 20px;
}

.editButtons {
  flex-direction: row;
  justify-content: space-around;
  margin-top: 20px;
}

.statsCard {
  flex-direction: row;
  justify-content: space-around;
  padding: 20px;
  background-color: #f9f9f9;
  margin: 0 15px 20px;
  border-radius: 10px;
}

.statItem {
  align-items: center;
}

.statValue {
  font-size: 24px;
  font-weight: bold;
  color: #0088cc;
}

.statLabel {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.levelCard {
  padding: 20px;
  background-color: #f9f9f9;
  margin: 0 15px 20px;
  border-radius: 10px;
}

.levelTitle {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.progressBar {
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin: 10px 0;
  overflow: hidden;
}

.progressFill {
  height: 8px;
  background-color: #0088cc;
}

.expText {
  font-size: 14px;
  color: #666;
  text-align: center;
}

.giftsSection {
  padding: 20px;
}

.sectionTitle {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 15px;
}

.giftsGrid {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
}

.giftItem {
  width: '23%';
  aspect-ratio: 1;
  background-color: #f9f9f9;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
}

.giftPlaceholder {
  width: '23%';
  aspect-ratio: 1;
  background-color: #f0f0f0;
  border-radius: 10px;
  margin-bottom: 8px;
}

/* ============================================
   НАСТРОЙКИ
   ============================================ */

.settingsContainer {
  flex: 1;
  background-color: white;
  padding: 15px;
}

.settingsMainTitle {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #0088cc;
}

.settingsSection {
  margin-bottom: 15px;
  border-radius: 10px;
  background-color: #f9f9f9;
  overflow: hidden;
}

.sectionHeader {
  flex-direction: row;
  align-items: center;
  padding: 15px;
  background-color: #f0f0f0;
}

.sectionTitle {
  flex: 1;
  font-size: 16px;
  font-weight: bold;
  margin-left: 10px;
}

.sectionContent {
  padding: 15px;
}

.settingItem {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom-width: 1px;
  border-bottom-color: #e0e0e0;
}

.settingItem:last-child {
  border-bottom-width: 0;
}

.settingValue {
  color: #666;
}

.settingInput {
  flex: 1;
  margin-left: 10px;
  padding: 5px;
  border-width: 1px;
  border-color: #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.settingLink {
  color: #0088cc;
}

.settingsFooter {
  margin-top: 30px;
  padding: 20px;
  align-items: center;
}

.footerLink {
  color: #0088cc;
  margin: 5px 0;
  font-size: 14px;
}

.picker {
  width: 150px;
  height: 40px;
}

/* ============================================
   АДМИН-ПАНЕЛЬ
   ============================================ */

.adminContainer {
  flex: 1;
  background-color: white;
  padding: 15px;
}

.adminTitle {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #0088cc;
}

.statsGrid {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 20px;
}

.statCard {
  width: '48%';
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.statNumber {
  font-size: 28px;
  font-weight: bold;
  color: #0088cc;
  margin-bottom: 5px;
}

.adminSearch {
  background-color: #f0f2f5;
  padding: 12px 15px;
  border-radius: 20px;
  margin-bottom: 15px;
  border-width: 1px;
  border-color: #ddd;
}

.adminUserList {
  max-height: 400px;
  margin-bottom: 15px;
}

.adminUserCard {
  flex-direction: row;
  padding: 12px;
  background-color: #f9f9f9;
  border-radius: 10px;
  margin-bottom: 8px;
  align-items: center;
}

.adminAvatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  margin-right: 12px;
}

.adminUserInfo {
  flex: 1;
}

.adminUserName {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 2px;
}

.adminUserEmail {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.adminUserBadges {
  flex-direction: row;
}

.roleBadge {
  padding: 3px 8px;
  border-radius: 12px;
  color: white;
  font-size: 10px;
  margin-right: 5px;
  overflow: hidden;
}

.bannedBadge {
  background-color: #ff4444;
  padding: 3px 8px;
  border-radius: 12px;
  color: white;
  font-size: 10px;
}

.adminButtons {
  flex-direction: row;
  justify-content: space-around;
  margin-top: 15px;
}

.adminButton {
  flex: 1;
  background-color: #0088cc;
  padding: 12px;
  border-radius: 10px;
  align-items: center;
  margin: 0 5px;
  flex-direction: row;
  justify-content: center;
}

.adminButtonText {
  color: white;
  margin-left: 5px;
  font-size: 14px;
}

/* Модалки */
.modalOverlay {
  flex: 1;
  background-color: rgba(0,0,0,0.5);
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.modalContent {
  background-color: white;
  border-radius: 10px;
  padding: 20px;
  width: '100%';
  max-width: 400px;
}

.userDetail {
  margin: 15px 0;
}

.userDetail Text {
  margin: 5px 0;
}

.adminActions {
  margin: 15px 0;
}

.adminActionButton {
  background-color: #f0f2f5;
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  margin: 5px 0;
}

.rolePicker {
  margin: 10px 0;
}

.closeButton {
  color: #0088cc;
  text-align: center;
  margin-top: 15px;
  font-size: 16px;
}

/* Жалобы */
.complaintCard {
  background-color: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.complaintCard Text {
  margin: 2px 0;
}

.complaintActions {
  flex-direction: row;
  justify-content: space-around;
  margin-top: 10px;
}

.complaintButton {
  background-color: #0088cc;
  padding: 5px 10px;
  border-radius: 5px;
}

.complaintButton Text {
  color: white;
  font-size: 12px;
}

/* Транзакции */
.transactionCard {
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.transactionCard Text {
  margin: 2px 0;
  font-size: 12px;
}

.modalButtons {
  flex-direction: row;
  justify-content: space-around;
  margin-top: 15px;
}

.modalButton {
  background-color: #0088cc;
  padding: 10px 20px;
  border-radius: 8px;
  min-width: 100px;
  align-items: center;
}

.modalButton Text {
  color: white;
}

/* Пустые состояния */
.emptyText {
  text-align: center;
  color: #666;
  margin-top: 50px;
  font-size: 16px;
}

/* ============================================
   НИЖНЯЯ НАВИГАЦИЯ
   ============================================ */

.tabBar {
  background-color: rgba(255,255,255,0.9);
  position: absolute;
  border-top-width: 0;
  elevation: 0;
  border-radius: 20px;
  margin-horizontal: 10px;
  margin-bottom: 10px;
  height: 60px;
}
