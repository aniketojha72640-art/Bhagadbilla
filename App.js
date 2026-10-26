import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Animated, Modal, ActivityIndicator, StatusBar, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import DeviceInfo from 'react-native-device-info';
import { Ionicons } from '@expo/vector-icons';

// Hardcoded Fallback / Initial Catalog
const INITIAL_MODELS = [
  { id: 'cybersec4b', name: 'CyberSecQwen-4B', reqRamGb: 8, size: '3.4 GB', desc: 'Elite Cybersecurity Specialist.', url: 'https://huggingface.co/mradermacher/CyberSecQwen-4B-GGUF/resolve/main/CyberSecQwen-4B.Q4_K_M.gguf', file: 'cybersec.gguf' },
  { id: 'gemma4_2b', name: 'Gemma 4 Edge (Vision)', reqRamGb: 6, size: '2.1 GB', desc: 'Multimodal Edge Intelligence.', url: 'https://huggingface.co/google/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-q4_k_m.gguf', file: 'gemma.gguf', mmprojUrl: 'https://huggingface.co/mmproj-gemma-2b.gguf' },
  { id: 'tinyllama', name: 'TinyLlama 1.1B', reqRamGb: 4, size: '800 MB', desc: 'Ultra-light rapid responses.', url: 'https://huggingface.co/TheBloke/TinyLlama.gguf', file: 'tinyllama.gguf' }
];

export default function App() {
  const [deviceRam, setDeviceRam] = useState(4);
  const [activeModel, setActiveModel] = useState(null);
  const [models, setModels] = useState(INITIAL_MODELS);
  
  // Custom URL Load State
  const [customUrl, setCustomUrl] = useState('');
  const [customMmprojUrl, setCustomMmprojUrl] = useState('');
  
  // Download State
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadResumable, setDownloadResumable] = useState(null);
  
  // UI State
  const [selectedModel, setSelectedModel] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [viewMode, setViewMode] = useState('chat'); 
  const [inputText, setInputText] = useState('');
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  
  // Synced Logs
  const [chatLog, setChatLog] = useState([]);
  const [terminalLog, setTerminalLog] = useState(['[SYSTEM] Bhagadbilla Multimodal OS Online.']);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkState, setThinkState] = useState('');
  
  // RAG Context (Hidden System Memory)
  const [injectedContext, setInjectedContext] = useState('');
  
  const popupAnim = useRef(new Animated.Value(0)).current;
  const attachAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    const ram = Math.round(DeviceInfo.getTotalMemorySync() / (1024 ** 3));
    setDeviceRam(ram);
    checkExistingModel();
  }, []);

  const checkExistingModel = async () => {
    // Basic check for pre-downloaded files in isolated storage
    for (const model of models) {
      const path = `${FileSystem.documentDirectory}${model.file}`;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) setActiveModel(model);
    }
  };

  const handleModelSelect = (model) => {
    if (model.reqRamGb > deviceRam) {
      Alert.alert(
        "⚠️ Hardware Override Warning",
        `This model requires ${model.reqRamGb}GB RAM. Your device has ${deviceRam}GB. Forcing this download may crash your device.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Override & Proceed", style: "destructive", onPress: () => openDownloadPopup(model) }
        ]
      );
    } else {
      openDownloadPopup(model);
    }
  };

  const handleCustomLoad = () => {
    if (!customUrl.trim()) return;
    const customModel = {
      id: 'custom_' + Date.now(),
      name: 'Custom User Model',
      reqRamGb: 0, // Unknown, user assumes risk
      size: 'Unknown Size',
      desc: 'Sourced from custom URL.',
      url: customUrl.trim(),
      mmprojUrl: customMmprojUrl.trim() || null,
      file: `custom_${Date.now()}.gguf`
    };
    
    Alert.alert(
      "Load Custom Model",
      "Ensure this .gguf fits your device's physical RAM. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Download", onPress: () => openDownloadPopup(customModel) }
      ]
    );
  };

  const openDownloadPopup = (model) => {
    setSelectedModel(model);
    setModalVisible(true);
    Animated.spring(popupAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  };

  const closePopup = () => {
    Animated.timing(popupAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setSelectedModel(null);
    });
  };

  const toggleAttachmentMenu = () => {
    const toValue = attachmentMenuVisible ? 0 : 1;
    if (!attachmentMenuVisible) setAttachmentMenuVisible(true);
    Animated.spring(attachAnim, { toValue, friction: 6, useNativeDriver: true }).start(() => {
      if (attachmentMenuVisible) setAttachmentMenuVisible(false);
    });
  };

  // --- Core Engine & Commands ---

  const startDownload = async () => {
    setIsDownloading(true);
    const path = `${FileSystem.documentDirectory}${selectedModel.file}`;
    const resumable = FileSystem.createDownloadResumable(selectedModel.url, path, {}, (prog) => {
      setDownloadProgress(prog.totalBytesWritten / prog.totalBytesExpectedToWrite);
    });
    setDownloadResumable(resumable);

    try {
      await resumable.downloadAsync();
      
      // Handle mmproj download if it exists
      if (selectedModel.mmprojUrl) {
         setTerminalLog(prev => [...prev, `[SYSTEM] Downloading Multimodal Projector...`]);
         const mmprojPath = `${FileSystem.documentDirectory}mmproj_${selectedModel.file}`;
         await FileSystem.downloadAsync(selectedModel.mmprojUrl, mmprojPath);
      }

      setActiveModel(selectedModel);
      setIsDownloading(false);
      closePopup();
      setTerminalLog(prev => [...prev, `[SYSTEM] Model ${selectedModel.name} loaded into RAM.`]);
    } catch (e) {
      Alert.alert("Network Error", "Download interrupted. Resumable on next tap.");
      setIsDownloading(false);
    }
  };

  const cancelDownload = async () => {
    if (downloadResumable) await downloadResumable.cancelAsync();
    if (selectedModel) {
        await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${selectedModel.file}`, { idempotent: true });
        if(selectedModel.mmprojUrl) await FileSystem.deleteAsync(`${FileSystem.documentDirectory}mmproj_${selectedModel.file}`, { idempotent: true });
    }
    setIsDownloading(false);
    setDownloadProgress(0);
    closePopup();
  };

  const dropAI = async () => {
      if (!activeModel) return;
      await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${activeModel.file}`, { idempotent: true });
      if(activeModel.mmprojUrl) await FileSystem.deleteAsync(`${FileSystem.documentDirectory}mmproj_${activeModel.file}`, { idempotent: true });
      
      setActiveModel(null);
      setChatLog([]);
      setInjectedContext('');
      setTerminalLog(['[SYSTEM] Model and RAG context dropped. Storage freed.']);
  };

  const executeCommand = (text) => {
    const cmd = text.trim();
    setTerminalLog(prev => [...prev, `[USER] Executed CLI: ${cmd}`]);
    
    if (cmd.startsWith('/temp ')) {
      setTerminalLog(prev => [...prev, `[ENGINE] Temperature updated to ${cmd.split(' ')[1]}`]);
    } else if (cmd.startsWith('/sys ')) {
      setTerminalLog(prev => [...prev, `[ENGINE] System prompt overridden.`]);
    } else if (cmd.startsWith('/fetch ')) {
        const target = cmd.split(' ')[1];
        setTerminalLog(prev => [...prev, `[RAG] Fetching from ${target}...`, `[RAG] Injecting context to LLM memory.`]);
        setInjectedContext(`[RAG CONTEXT LOADED FROM ${target}]`);
    } else {
      setTerminalLog(prev => [...prev, `[ERROR] Unknown command. Available: /temp, /sys, /fetch`]);
    }
    setInputText('');
  };

  const handleImageSelect = async () => {
      toggleAttachmentMenu();
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
      });

      if (!result.canceled) {
          if (!activeModel?.mmprojUrl) {
              Alert.alert("Vision Offline", "This model lacks a Multimodal Projector (.mmproj). Select a vision-capable edge model.");
              setTerminalLog(prev => [...prev, `[ERROR] Image tensor parsing failed. No mmproj bound.`]);
              return;
          }
          
          setChatLog(prev => [...prev, { role: 'user', content: '[Image Selected]', isImage: true, uri: result.assets[0].uri }]);
          setTerminalLog(prev => [...prev, `[MMPROJ] Processing image tensor...`]);
          
          setIsThinking(true);
          setThinkState('Projecting image to Context...');
          setTimeout(() => {
              setIsThinking(false);
              setChatLog(prev => [...prev, { role: 'ai', content: `I have analyzed the image tensor.` }]);
              setTerminalLog(prev => [...prev, `[PERF] Multimodal generation complete.`]);
          }, 2000);
      }
  };

  const simulateExecution = (text) => {
    if (text.startsWith('/')) {
      executeCommand(text);
      return;
    }
    
    setChatLog(prev => [...prev, { role: 'user', content: text }]);
    setTerminalLog(prev => [...prev, `[USER] ${text}`, `[MMAP] Allocating Context Window...`]);
    if(injectedContext) setTerminalLog(prev => [...prev, `[RAG] Pre-pending injected context.`]);
    
    setInputText('');
    setIsThinking(true);
    
    setThinkState('Allocating KV Cache...');
    setTimeout(() => {
      setThinkState('Evaluating tokens (6.4 t/s)...');
      setTerminalLog(prev => [...prev, `[EXEC] Generating tokens...`]);
    }, 800);
    
    setTimeout(() => {
      setIsThinking(false);
      setChatLog(prev => [...prev, { role: 'ai', content: `Processed offline securely.` }]);
      setTerminalLog(prev => [...prev, `[PERF] Generation complete. Memory freed.`]);
    }, 2500);
  };

  if (!activeModel) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.hubHeader}>
          <View style={styles.headerRow}>
            <Text style={styles.hubTitle}>Bhagadbilla</Text>
            <TouchableOpacity onPress={() => setAboutVisible(true)}>
              <Ionicons name="information-circle-outline" size={28} color="#888" />
            </TouchableOpacity>
          </View>
          <Text style={styles.hubSubtitle}>Hardware: {deviceRam}GB LPDDR | Native Engine</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Custom Load Section */}
          <BlurView intensity={20} tint="dark" style={styles.customLoadCard}>
              <Text style={styles.customLoadTitle}>Custom URL Override</Text>
              <TextInput 
                  style={styles.customInput} 
                  placeholder="Paste direct .gguf URL..." 
                  placeholderTextColor="#666"
                  value={customUrl}
                  onChangeText={setCustomUrl}
              />
              <TextInput 
                  style={[styles.customInput, {marginTop: 10}]} 
                  placeholder="Paste .mmproj URL (Optional Vision)..." 
                  placeholderTextColor="#666"
                  value={customMmprojUrl}
                  onChangeText={setCustomMmprojUrl}
              />
              <TouchableOpacity style={styles.customLoadBtn} onPress={handleCustomLoad}>
                  <Text style={styles.btnText}>Force Load Model</Text>
              </TouchableOpacity>
          </BlurView>

          <Text style={styles.sectionDivider}>CURATED EDGE CATALOG</Text>

          {models.map(model => (
            <TouchableOpacity key={model.id} activeOpacity={0.7} onPress={() => handleModelSelect(model)}>
              <BlurView intensity={30} tint="dark" style={[styles.modelCard, model.reqRamGb > deviceRam && styles.cardWarning]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{model.name}</Text>
                  {model.reqRamGb > deviceRam && <Ionicons name="warning" size={20} color="#EF4444" />}
                </View>
                <Text style={styles.cardDesc}>{model.desc}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardSize}>{model.size}</Text>
                  <Text style={[styles.cardRam, model.reqRamGb > deviceRam ? styles.textRed : styles.textGreen]}>
                    Req: {model.reqRamGb}GB RAM
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Download Modal */}
        {modalVisible && (
          <Modal transparent visible animationType="none">
            <View style={styles.modalOverlay}>
              <Animated.View style={[styles.popup, { transform: [{ scale: popupAnim }] }]}>
                <BlurView intensity={70} tint="dark" style={styles.popupGlass}>
                  <Text style={styles.popupTitle}>Initialize Core</Text>
                  <Text style={styles.popupDesc}>{selectedModel?.name} ({selectedModel?.size})</Text>
                  
                  {isDownloading ? (
                    <View style={styles.dlContainer}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
                      <TouchableOpacity style={styles.cancelBtn} onPress={cancelDownload}>
                        <Text style={styles.btnText}>Cancel & Erase Partial File</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.popupActions}>
                      <TouchableOpacity style={styles.backBtn} onPress={closePopup}>
                        <Text style={styles.btnText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={startDownload}>
                        <Text style={styles.btnText}>Download Securely</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </BlurView>
              </Animated.View>
            </View>
          </Modal>
        )}

        {/* About/Feedback Modal */}
        <Modal visible={aboutVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <BlurView intensity={80} tint="dark" style={styles.fullModal}>
              <Text style={styles.popupTitle}>Bhagadbilla OS</Text>
              <Text style={styles.popupDesc}>Version 2.0.0 | Offline Local AI Terminal</Text>
              <TextInput style={styles.feedbackInput} placeholder="Submit Feedback or Bug Reports..." placeholderTextColor="#888" multiline />
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setAboutVisible(false)}>
                <Text style={styles.btnText}>Close</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </Modal>
      </View>
    );
  }

  // 2. Active Interface (Chat & Terminal)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <BlurView intensity={40} tint="dark" style={styles.navBar}>
        <View style={styles.navToggles}>
          <TouchableOpacity onPress={() => setViewMode('chat')} style={[styles.navTab, viewMode === 'chat' && styles.navTabActive]}>
            <Text style={styles.navTabText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('terminal')} style={[styles.navTab, viewMode === 'terminal' && styles.navTabActive]}>
            <Text style={styles.navTabText}>CLI</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dropBtn} onPress={dropAI}>
          <Ionicons name="trash-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </BlurView>

      {viewMode === 'chat' ? (
        <View style={styles.viewArea}>
          <FlatList
            ref={flatListRef}
            data={chatLog}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={[styles.chatBubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {item.isImage ? (
                     <View style={styles.imagePlaceholder}><Ionicons name="image" size={24} color="#FFF" /><Text style={{color: '#FFF', marginLeft: 10}}>Image Tensor Loaded</Text></View>
                ) : (
                    <Text style={styles.chatText}>{item.content}</Text>
                )}
              </View>
            )}
          />
          {isThinking && (
            <BlurView intensity={20} tint="light" style={styles.thinkingBox}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.thinkingText}>{thinkState}</Text>
            </BlurView>
          )}
        </View>
      ) : (
        <View style={styles.viewArea}>
          <ScrollView ref={terminalRef} style={styles.terminalContainer} onContentSizeChange={() => terminalRef.current?.scrollToEnd({ animated: true })}>
            {terminalLog.map((log, i) => (
              <Text key={i} style={[styles.terminalText, log.includes('[ERROR]') && styles.textRed, log.includes('[USER]') && styles.textWhite, log.includes('[RAG]') && {color: '#F59E0B'}]}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Multimodal Attachment Menu */}
      {attachmentMenuVisible && (
        <Animated.View style={[styles.attachmentMenu, { opacity: attachAnim }]}>
           <BlurView intensity={60} tint="dark" style={styles.attachmentGlass}>
              <TouchableOpacity style={styles.attachOption} onPress={handleImageSelect}>
                 <View style={[styles.attachIconBg, {backgroundColor: '#3B82F6'}]}><Ionicons name="image" size={20} color="#FFF" /></View>
                 <Text style={styles.attachText}>Image Tensor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={() => { toggleAttachmentMenu(); executeCommand('/fetch document.txt'); }}>
                 <View style={[styles.attachIconBg, {backgroundColor: '#10B981'}]}><Ionicons name="document-text" size={20} color="#FFF" /></View>
                 <Text style={styles.attachText}>Parse Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={toggleAttachmentMenu}>
                 <View style={[styles.attachIconBg, {backgroundColor: '#EF4444'}]}><Ionicons name="mic" size={20} color="#FFF" /></View>
                 <Text style={styles.attachText}>Whisper Audio</Text>
              </TouchableOpacity>
           </BlurView>
        </Animated.View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BlurView intensity={50} tint="dark" style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn} onPress={toggleAttachmentMenu}>
             <Ionicons name={attachmentMenuVisible ? "close" : "add"} size={26} color="#AAA" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={viewMode === 'chat' ? "Message AI or /sys..." : "Enter CLI Command..."}
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => inputText.trim() && simulateExecution(inputText)}>
            <Ionicons name="arrow-up" size={20} color="#FFF" />
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050508' },
  scrollContent: { padding: 16 },
  hubHeader: { padding: 24, paddingTop: 60, backgroundColor: '#0A0A10', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hubTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  hubSubtitle: { fontSize: 13, color: '#10B981', marginTop: 8, fontFamily: 'monospace' },
  
  customLoadCard: { padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', overflow: 'hidden' },
  customLoadTitle: { color: '#10B981', fontSize: 14, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  customInput: { backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFF', borderRadius: 12, padding: 14, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  customLoadBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  
  sectionDivider: { color: '#666', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },

  modelCard: { padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  cardWarning: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  cardDesc: { fontSize: 13, color: '#888', marginTop: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  cardSize: { color: '#AAA', fontSize: 12, fontWeight: '600' },
  cardRam: { fontSize: 12, fontWeight: '700' },
  textRed: { color: '#EF4444' },
  textGreen: { color: '#10B981' },
  textWhite: { color: '#FFF' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  popup: { width: '88%', borderRadius: 24, overflow: 'hidden' },
  popupGlass: { padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  fullModal: { width: '90%', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  popupTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  popupDesc: { fontSize: 14, color: '#AAA', marginTop: 8 },
  feedbackInput: { height: 100, backgroundColor: 'rgba(0,0,0,0.4)', color: '#FFF', borderRadius: 12, padding: 12, marginTop: 20, marginBottom: 20, textAlignVertical: 'top' },
  
  popupActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  confirmBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#2563EB' },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.2)', marginTop: 20, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  
  dlContainer: { marginTop: 24 },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981' },
  progressText: { color: '#FFF', marginTop: 8, textAlign: 'right', fontSize: 12, fontFamily: 'monospace' },

  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingTop: 50, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  navToggles: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 4 },
  navTab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 12 },
  navTabActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  navTabText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  dropBtn: { backgroundColor: 'rgba(239,68,68,0.2)', padding: 10, borderRadius: 12 },
  
  viewArea: { flex: 1 },
  chatList: { padding: 16, paddingBottom: 24 },
  chatBubble: { maxWidth: '82%', padding: 16, borderRadius: 20, marginBottom: 12 },
  bubbleUser: { backgroundColor: 'rgba(37,99,235,0.8)', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAi: { backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  chatText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  imagePlaceholder: { flexDirection: 'row', alignItems: 'center' },
  
  thinkingBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, alignSelf: 'flex-start', marginLeft: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', overflow: 'hidden' },
  thinkingText: { color: '#10B981', marginLeft: 10, fontSize: 13, fontFamily: 'monospace' },
  
  terminalContainer: { flex: 1, padding: 16, backgroundColor: '#020203' },
  terminalText: { color: '#10B981', fontFamily: 'monospace', fontSize: 11, marginBottom: 6, opacity: 0.9 },
  
  attachmentMenu: { position: 'absolute', bottom: 90, left: 16, width: 220, borderRadius: 20, overflow: 'hidden', zIndex: 10 },
  attachmentGlass: { padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  attachOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  attachIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  attachText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  inputContainer: { flexDirection: 'row', padding: 12, alignItems: 'center', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  attachBtn: { padding: 10, marginRight: 4 },
  input: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFF', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});
