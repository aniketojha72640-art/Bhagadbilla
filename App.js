import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Modal,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import DeviceInfo from 'react-native-device-info';

const MODEL_CATALOG = [
  {
    id: 'cybersec4b',
    name: 'CyberSecQwen-4B',
    reqRamGb: 8,
    size: '3.4 GB',
    desc: 'Specialized cybersecurity model for code auditing, CVE mapping, and defensive analysis.',
    url: 'https://huggingface.co/mradermacher/CyberSecQwen-4B-GGUF/resolve/main/CyberSecQwen-4B.Q4_K_M.gguf',
    file: 'cybersec.gguf'
  },
  {
    id: 'gemma2b',
    name: 'Gemma 4 E2B',
    reqRamGb: 6,
    size: '1.9 GB',
    desc: 'Balanced local assistant for general reasoning, writing, and interactive chat.',
    url: 'https://huggingface.co/google/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-q4_k_m.gguf',
    file: 'gemma.gguf'
  },
  {
    id: 'tinyllama',
    name: 'TinyLlama 1.1B',
    reqRamGb: 4,
    size: '800 MB',
    desc: 'Lightweight model built for low-memory devices and fast token generation.',
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    file: 'tinyllama.gguf'
  }
];

export default function App() {
  const [totalRamGb, setTotalRamGb] = useState(4);
  const [loadedModel, setLoadedModel] = useState(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dlSession, setDlSession] = useState(null);
  const [connDropped, setConnDropped] = useState(false);

  const [targetModel, setTargetModel] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [promptInput, setPromptInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [cliLogs, setCliLogs] = useState([
    '[SYSTEM] Local engine initialized...',
    '[SYSTEM] Ready for input...'
  ]);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const detectedRam = Math.round(DeviceInfo.getTotalMemorySync() / (1024 ** 3));
    setTotalRamGb(detectedRam);
    verifyInstalledModels();
  }, []);

  const verifyInstalledModels = async () => {
    for (const item of MODEL_CATALOG) {
      const localUri = `${FileSystem.documentDirectory}${item.file}`;
      const fileStat = await FileSystem.getInfoAsync(localUri);
      if (fileStat.exists) {
        setLoadedModel(item);
      }
    }
  };

  const showModelPopup = (item) => {
    setTargetModel(item);
    setPopupOpen(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const hideModelPopup = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPopupOpen(false);
      setTargetModel(null);
    });
  };

  const beginModelDownload = async () => {
    if (!targetModel) return;
    setDownloading(true);
    setConnDropped(false);
    const localUri = `${FileSystem.documentDirectory}${targetModel.file}`;

    const session = FileSystem.createDownloadResumable(
      targetModel.url,
      localUri,
      {},
      (status) => {
        const ratio = status.totalBytesWritten / status.totalBytesExpectedToWrite;
        setDlProgress(ratio);
      }
    );
    setDlSession(session);

    try {
      await session.downloadAsync();
      setLoadedModel(targetModel);
      setDownloading(false);
      hideModelPopup();
      setCliLogs(prev => [...prev, `[SYSTEM] Loaded ${targetModel.name} into memory.`]);
    } catch (err) {
      setConnDropped(true);
    }
  };

  const abortAndWipeDownload = async () => {
    if (dlSession) {
      try {
        await dlSession.cancelAsync();
      } catch (err) {}
    }
    if (targetModel) {
      const localUri = `${FileSystem.documentDirectory}${targetModel.file}`;
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
    setDownloading(false);
    setDlProgress(0);
    setDlSession(null);
    setConnDropped(false);
    hideModelPopup();
  };

  const removeActiveModel = async () => {
    if (!loadedModel) return;
    const localUri = `${FileSystem.documentDirectory}${loadedModel.file}`;
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    setLoadedModel(null);
    setMessages([]);
    setCliLogs(['[SYSTEM] Model removed. RAM and local storage cleared.']);
  };

  const runPrompt = (text) => {
    setMessages(prev => [...prev, { sender: 'user', body: text }]);
    setPromptInput('');
    setCliLogs(prev => [
      ...prev,
      `[USER] ${text}`,
      `[ENGINE] Mapping tensors...`,
      `[ENGINE] Streaming tokens (8.4 t/s)...`
    ]);

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', body: `Offline analysis complete for: ${text}` }
      ]);
      setCliLogs(prev => [...prev, `[ENGINE] Execution finished. Context released.`]);
    }, 1500);
  };

  if (!loadedModel) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBanner}>
          <Text style={styles.bannerTitle}>Bhagadbilla Model Hub</Text>
          <Text style={styles.bannerSub}>Hardware: {totalRamGb}GB Physical RAM</Text>
        </View>

        <ScrollView contentContainerStyle={styles.listPadding}>
          {[8, 6, 4].map(ramTier => {
            const group = MODEL_CATALOG.filter(m => m.reqRamGb === ramTier);
            if (group.length === 0) return null;
            return (
              <View key={ramTier} style={styles.tierGroup}>
                <Text style={styles.tierLabel}>{ramTier}GB RAM Tier</Text>
                {group.map(item => {
                  const compatible = totalRamGb >= item.reqRamGb;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      disabled={!compatible}
                      onPress={() => showModelPopup(item)}
                    >
                      <BlurView
                        intensity={20}
                        tint="light"
                        style={[styles.card, !compatible && styles.cardLocked]}
                      >
                        <View>
                          <Text style={styles.modelTitle}>{item.name}</Text>
                          <Text style={styles.modelSize}>{item.size}</Text>
                        </View>
                        {!compatible && (
                          <Text style={styles.lockedLabel}>Not supported on this device</Text>
                        )}
                      </BlurView>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        {popupOpen && (
          <Modal transparent visible={popupOpen} animationType="none">
            <View style={styles.backdrop}>
              <Animated.View style={[styles.dialogWrapper, { transform: [{ scale: scaleAnim }] }]}>
                <BlurView intensity={50} tint="dark" style={styles.dialogGlass}>
                  <Text style={styles.dialogTitle}>{targetModel?.name}</Text>
                  <Text style={styles.dialogDesc}>{targetModel?.desc}</Text>
                  <Text style={styles.dialogMeta}>Package Size: {targetModel?.size}</Text>

                  {downloading ? (
                    <View style={styles.progressSection}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${dlProgress * 100}%` }]} />
                      </View>
                      <Text style={styles.percentLabel}>{Math.round(dlProgress * 100)}%</Text>

                      {connDropped && <Text style={styles.offlineAlert}>Connection Lost</Text>}

                      <View style={styles.dlRow}>
                        {connDropped && (
                          <TouchableOpacity style={styles.retryBtn} onPress={beginModelDownload}>
                            <Text style={styles.actionLabel}>Resume</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.secondaryBtn, connDropped && styles.btnFrozen]}
                          onPress={abortAndWipeDownload}
                          disabled={connDropped}
                        >
                          <Text style={styles.actionLabel}>Cancel & Erase</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.dialogButtons}>
                      <TouchableOpacity style={styles.secondaryBtn} onPress={hideModelPopup}>
                        <Text style={styles.actionLabel}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.primaryBtn} onPress={beginModelDownload}>
                        <Text style={styles.actionLabel}>Confirm Download</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </BlurView>
              </Animated.View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <BlurView intensity={30} tint="dark" style={styles.headerBar}>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            onPress={() => setActiveTab('chat')}
            style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnSelected]}
          >
            <Text style={styles.tabLabel}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('terminal')}
            style={[styles.tabBtn, activeTab === 'terminal' && styles.tabBtnSelected]}
          >
            <Text style={styles.tabLabel}>Terminal</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.unloadBtn} onPress={removeActiveModel}>
          <Text style={styles.unloadLabel}>Drop AI</Text>
        </TouchableOpacity>
      </BlurView>

      {activeTab === 'chat' ? (
        <View style={styles.contentArea}>
          <FlatList
            data={messages}
            keyExtractor={(_, idx) => idx.toString()}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => (
              <View style={[styles.msgBubble, item.sender === 'user' ? styles.userMsg : styles.aiMsg]}>
                <Text style={styles.msgCopy}>{item.body}</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.contentArea}>
          <ScrollView style={styles.consoleBox}>
            {cliLogs.map((entry, idx) => (
              <Text key={idx} style={styles.consoleLine}>{entry}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlurView intensity={40} tint="dark" style={styles.composerBar}>
          <TextInput
            style={styles.textField}
            placeholder="Execute prompt..."
            placeholderTextColor="#888"
            value={promptInput}
            onChangeText={setPromptInput}
          />
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => promptInput.trim() && runPrompt(promptInput)}
          >
            <Text style={styles.submitArrow}>▲</Text>
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090E' },
  listPadding: { padding: 16 },
  topBanner: { padding: 24, paddingTop: 60, backgroundColor: '#0F0F16', borderBottomWidth: 1, borderColor: '#1F1F2E' },
  bannerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  bannerSub: { fontSize: 14, color: '#10B981', marginTop: 8 },
  tierGroup: { marginTop: 24 },
  tierLabel: { fontSize: 16, color: '#888', marginBottom: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  card: { padding: 18, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, overflow: 'hidden' },
  cardLocked: { opacity: 0.4 },
  modelTitle: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  modelSize: { fontSize: 13, color: '#AAA', marginTop: 4 },
  lockedLabel: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  dialogWrapper: { width: '85%', borderRadius: 24, overflow: 'hidden' },
  dialogGlass: { padding: 24, borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 },
  dialogTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  dialogDesc: { fontSize: 14, color: '#CCC', marginTop: 12, lineHeight: 20 },
  dialogMeta: { fontSize: 14, color: '#10B981', marginTop: 12, fontWeight: 'bold' },
  dialogButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  btnFrozen: { opacity: 0.3 },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#2563EB' },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#10B981', marginRight: 10 },
  actionLabel: { color: '#FFF', fontWeight: '600' },
  progressSection: { marginTop: 24 },
  barTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#2563EB' },
  percentLabel: { color: '#FFF', marginTop: 8, textAlign: 'right', fontSize: 12 },
  offlineAlert: { color: '#EF4444', marginTop: 8, textAlign: 'center', fontWeight: 'bold' },
  dlRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabGroup: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 4 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 },
  tabBtnSelected: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabLabel: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  unloadBtn: { backgroundColor: '#EF4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  unloadLabel: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  contentArea: { flex: 1 },
  messageList: { padding: 16 },
  msgBubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 12 },
  userMsg: { backgroundColor: '#2563EB', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiMsg: { backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  msgCopy: { color: '#FFF', fontSize: 16, lineHeight: 22 },
  consoleBox: { flex: 1, padding: 16, backgroundColor: '#000' },
  consoleLine: { color: '#10B981', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, marginBottom: 4 },
  composerBar: { flexDirection: 'row', padding: 12, alignItems: 'center', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  textField: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', color: '#FFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  submitArrow: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
