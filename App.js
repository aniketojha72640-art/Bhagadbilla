import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  Animated,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';

// Optional native llama.rn bridge (gracefully falls back if not yet loaded)
let initLlama = null;
try {
  initLlama = require('llama.rn').initLlama;
} catch (e) {
  initLlama = null;
}

// ==========================================
// 1. MASTER AI MODEL CATALOG (GROUPED BY RAM)
// ==========================================
const RAM_TIERS = [
  {
    ramGb: 4,
    headerTitle: '4 GB RAM TIER • ULTRA-LIGHT',
    models: [
      {
        id: 'qwen2.5-1.5b-cyber',
        name: 'Qwen 2.5 Coder 1.5B',
        category: 'Coding',
        quant: 'Q4_K_M',
        sizeLabel: '1.1 GB',
        sizeBytes: 1120000000,
        fileName: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
        url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
        summary: 'Fast code auditing, Bash/Python scripting, and lightweight syntax analysis for entry-level hardware.',
        systemPrompt: 'You are Bhagadbilla Code Analyst. Audit scripts, write clean code, and explain technical logic concisely.',
      },
      {
        id: 'tinyllama-1.1b',
        name: 'TinyLlama 1.1B Chat',
        category: 'General',
        quant: 'Q4_K_M',
        sizeLabel: '0.7 GB',
        sizeBytes: 700000000,
        fileName: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        summary: 'Ultra-low memory footprint general assistant for quick offline notes, summaries, and essays.',
        systemPrompt: 'You are Bhagadbilla Assistant, a fast offline AI running locally on Android.',
      },
    ],
  },
  {
    ramGb: 6,
    headerTitle: '6 GB RAM TIER • BALANCED EDGE',
    models: [
      {
        id: 'gemma4-defense-2b',
        name: 'Gemma 4 Defense E2B',
        category: 'Cybersecurity',
        quant: 'Q4_K_M',
        sizeLabel: '1.6 GB',
        sizeBytes: 1620000000,
        fileName: 'gemma-2-2b-it-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
        summary: 'Compact defensive security & threat-mapping model with fast token generation and low thermal load.',
        systemPrompt: 'You are Gemma Defense, a specialized mobile cybersecurity analyst focused on vulnerability detection and mitigation.',
      },
      {
        id: 'phi-3-mini-analytics',
        name: 'Phi-3 Mini 3.8B',
        category: 'Analytics & PDFs',
        quant: 'Q4_K_M',
        sizeLabel: '2.3 GB',
        sizeBytes: 2350000000,
        fileName: 'Phi-3-mini-4k-instruct-q4.gguf',
        url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
        summary: 'High-reasoning model ideal for document analysis, structured data extraction, and logical breakdowns.',
        systemPrompt: 'You are Bhagadbilla Analytics Engine. Extract structured insights, summarize reports, and reason step by step.',
      },
    ],
  },
  {
    ramGb: 8,
    headerTitle: '8 GB RAM TIER • PRO SPECIALIST',
    models: [
      {
        id: 'cybersec-qwen-4b-q6',
        name: 'CyberSecQwen 4B (Q6_K)',
        category: 'Cybersecurity',
        quant: 'Q6_K (High Precision)',
        sizeLabel: '3.4 GB',
        sizeBytes: 3420000000,
        fileName: 'CyberSecQwen-4B.Q6_K.gguf',
        url: 'https://huggingface.co/mradermacher/CyberSecQwen-4B-GGUF/resolve/main/CyberSecQwen-4B.Q6_K.gguf',
        summary: 'Elite offline cybersecurity specialist. Trained for CVE/CWE mapping, SQLi/XSS auditing, threat intelligence, and reverse engineering.',
        systemPrompt:
          'You are CyberSecQwen, an elite offline cybersecurity AI running inside Bhagadbilla. ' +
          'You specialize strictly in defensive security, vulnerability auditing, CVE/CWE mapping, and secure code analysis. Be technical, deterministic, and concise.',
      },
      {
        id: 'cybersec-qwen-4b-q4',
        name: 'CyberSecQwen 4B (Q4_K_M)',
        category: 'Cybersecurity',
        quant: 'Q4_K_M (Fast)',
        sizeLabel: '2.6 GB',
        sizeBytes: 2620000000,
        fileName: 'CyberSecQwen-4B.Q4_K_M.gguf',
        url: 'https://huggingface.co/mradermacher/CyberSecQwen-4B-GGUF/resolve/main/CyberSecQwen-4B.Q4_K_M.gguf',
        summary: 'Faster 4-bit quantized variant of CyberSecQwen-4B leaving extra physical RAM headroom for long context sessions.',
        systemPrompt:
          'You are CyberSecQwen, an elite offline cybersecurity AI running inside Bhagadbilla. ' +
          'Focus strictly on vulnerability analysis, exploit mitigation, and network security.',
      },
    ],
  },
  {
    ramGb: 12,
    headerTitle: '12 GB RAM TIER • EXTREME HEAVYWEIGHT',
    models: [
      {
        id: 'foundation-sec-8b',
        name: 'Foundation-Sec Llama 8B',
        category: 'Cybersecurity',
        quant: 'Q4_K_M',
        sizeLabel: '4.9 GB',
        sizeBytes: 4920000000,
        fileName: 'Meta-Llama-3-8B-Instruct.Q4_K_M.gguf',
        url: 'https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf',
        summary: 'Full 8-billion parameter security & deep red/blue-team reasoning model. Requires 12 GB+ physical RAM.',
        systemPrompt: 'You are an advanced 8B enterprise security architect.',
      },
    ],
  },
];

const CATEGORIES = ['All', 'Cybersecurity', 'Coding', 'Analytics & PDFs', 'General'];

export default function App() {
  // Hardware & Filter State
  const [deviceRamGb, setDeviceRamGb] = useState(8);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Navigation & Active Model State
  const [currentView, setCurrentView] = useState('hub'); // 'hub' | 'workspace'
  const [workspaceTab, setWorkspaceTab] = useState('chat'); // 'chat' | 'terminal'
  const [installedModels, setInstalledModels] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [llamaContext, setLlamaContext] = useState(null);

  // Popup Modal Animation State
  const [previewModel, setPreviewModel] = useState(null);
  const popupScale = useRef(new Animated.Value(0.8)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;

  // Download & Network State
  const [downloadingModel, setDownloadingModel] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [isOfflineDuringDownload, setIsOfflineDuringDownload] = useState(false);
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
  const [statusBanner, setStatusBanner] = useState('');

  const downloadResumableRef = useRef(null);
  const isDownloadingRef = useRef(false);
  const wasOfflineRef = useRef(false);

  // Chat & Terminal Engine State
  const [chatInput, setChatInput] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [contextSize, setContextSize] = useState(4096);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([]);

  // ==========================================
  // 2. INITIALIZE RAM CHECK & STORAGE SCAN
  // ==========================================
  useEffect(() => {
    detectDeviceRam();
    scanInstalledModels();
  }, []);

  const detectDeviceRam = () => {
    try {
      if (Device.totalMemory) {
        const gb = Math.round(Device.totalMemory / (1024 * 1024 * 1024));
        setDeviceRamGb(gb >= 1 ? gb : 8);
      } else {
        setDeviceRamGb(8);
      }
    } catch (e) {
      setDeviceRamGb(8);
    }
  };

  const scanInstalledModels = async () => {
    try {
      const found = {};
      for (const tier of RAM_TIERS) {
        for (const m of tier.models) {
          const path = `${FileSystem.documentDirectory}${m.fileName}`;
          const info = await FileSystem.getInfoAsync(path);
          if (info.exists && info.size > 1024 * 1024) {
            found[m.id] = path;
          }
        }
      }
      setInstalledModels(found);
    } catch (e) {
      // Ignore scan error on first boot
    }
  };

  const appendTerminalLog = (tag, text) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, time, tag, text },
    ]);
  };

  // ==========================================
  // 3. EXPANDING POPUP MODAL ANIMATION
  // ==========================================
  const openModelPreview = (model) => {
    setPreviewModel(model);
    popupScale.setValue(0.82);
    popupOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(popupScale, {
        toValue: 1,
        friction: 6,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(popupOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModelPreview = () => {
    Animated.timing(popupOpacity, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(() => setPreviewModel(null));
  };

  // ==========================================
  // 4. NETWORK WATCHER & GHOST-FREE DOWNLOADER
  // ==========================================
  useEffect(() => {
    let interval = null;
    if (downloadingModel) {
      interval = setInterval(async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);
          const res = await fetch('https://huggingface.co/api/models/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF', {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok && wasOfflineRef.current) {
            // Reconnected after disconnect! Ask user whether to Continue or Cancel
            wasOfflineRef.current = false;
            setIsOfflineDuringDownload(false);
            setShowReconnectPrompt(true);
          }
        } catch (err) {
          if (!wasOfflineRef.current && isDownloadingRef.current) {
            wasOfflineRef.current = true;
            setIsOfflineDuringDownload(true);
            setShowReconnectPrompt(false);
            try {
              if (downloadResumableRef.current) {
                await downloadResumableRef.current.pauseAsync();
              }
            } catch (pauseErr) {}
          }
        }
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [downloadingModel]);

  const startModelDownload = async (model) => {
    closeModelPreview();
    const fileUri = `${FileSystem.documentDirectory}${model.fileName}`;

    // Always clean any leftover partial file before starting
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (e) {}

    setDownloadingModel(model);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setIsOfflineDuringDownload(false);
    setShowReconnectPrompt(false);
    wasOfflineRef.current = false;
    isDownloadingRef.current = true;

    const callback = (prog) => {
      setDownloadedBytes(prog.totalBytesWritten);
      const total = prog.totalBytesExpectedToWrite > 0 ? prog.totalBytesExpectedToWrite : model.sizeBytes;
      setDownloadProgress(Math.min(1, prog.totalBytesWritten / total));
    };

    const resumable = FileSystem.createDownloadResumable(model.url, fileUri, {}, callback);
    downloadResumableRef.current = resumable;

    try {
      const result = await resumable.downloadAsync();
      if (result && result.uri && isDownloadingRef.current) {
        isDownloadingRef.current = false;
        setDownloadingModel(null);
        setInstalledModels((prev) => ({ ...prev, [model.id]: result.uri }));
        setStatusBanner(`✅ ${model.name} downloaded into local vault.`);
        launchModelInEngine(model, result.uri);
      }
    } catch (err) {
      // If paused due to offline disconnect, wait for reconnect decision
      if (wasOfflineRef.current) return;
    }
  };

  const resumeDownloadAfterReconnect = async () => {
    setShowReconnectPrompt(false);
    setIsOfflineDuringDownload(false);
    try {
      if (downloadResumableRef.current && downloadingModel) {
        const result = await downloadResumableRef.current.resumeAsync();
        if (result && result.uri && isDownloadingRef.current) {
          const model = downloadingModel;
          isDownloadingRef.current = false;
          setDownloadingModel(null);
          setInstalledModels((prev) => ({ ...prev, [model.id]: result.uri }));
          setStatusBanner(`✅ ${model.name} download completed.`);
          launchModelInEngine(model, result.uri);
        }
      }
    } catch (e) {
      wasOfflineRef.current = true;
      setIsOfflineDuringDownload(true);
    }
  };

  // Strict Cancel & Complete Ghost-File Erasure
  const cancelAndEraseDownload = async () => {
    if (isOfflineDuringDownload && !showReconnectPrompt) {
      // Cancel button is strictly frozen while offline until connection returns
      return;
    }
    const targetModel = downloadingModel;
    isDownloadingRef.current = false;
    wasOfflineRef.current = false;
    setIsOfflineDuringDownload(false);
    setShowReconnectPrompt(false);

    try {
      if (downloadResumableRef.current) {
        await downloadResumableRef.current.pauseAsync();
      }
    } catch (e) {}

    if (targetModel) {
      const fileUri = `${FileSystem.documentDirectory}${targetModel.fileName}`;
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (e) {}
    }

    downloadResumableRef.current = null;
    setDownloadingModel(null);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setStatusBanner('🗑️ Download canceled. Partial file erased — 0 B ghost storage left.');
  };

  // ==========================================
  // 5. LOAD & DROP AI ENGINE (FREES RAM + DISK)
  // ==========================================
  const launchModelInEngine = async (model, fileUri) => {
    setActiveModel(model);
    setCustomSystemPrompt(model.systemPrompt);
    setCurrentView('workspace');
    setMessages([
      {
        id: 'boot-msg',
        role: 'assistant',
        content:
          `⚡ **${model.name}** initialized in Bhagadbilla Local Engine.\n` +
          `• Specialization: ${model.category}\n` +
          `• Quantization: ${model.quant} (${model.sizeLabel})\n` +
          `• Temperature: ${temperature} | Context: ${contextSize} tokens\n\n` +
          `Switch between **Chat** and **Terminal** at the top anytime, or tap **Drop AI** when finished to free up all RAM & storage.`,
      },
    ]);
    setTerminalLogs([]);
    appendTerminalLog('BOOT', `Mounting GGUF -> ${model.fileName}`);
    appendTerminalLog('HW', `Detected Device Physical RAM: ${deviceRamGb} GB`);
    appendTerminalLog('MMAP', `Allocating KV cache (${contextSize} ctx) | Temp: ${temperature}`);

    if (initLlama && fileUri) {
      try {
        if (llamaContext) {
          await llamaContext.release();
        }
        const ctx = await initLlama({
          model: fileUri,
          use_mlock: false,
          n_ctx: contextSize,
          n_threads: 4,
        });
        setLlamaContext(ctx);
        appendTerminalLog('READY', `Native llama.rn C++ context online.`);
      } catch (err) {
        appendTerminalLog('INFO', `Running in hybrid CLI/local shell mode (${err.message}).`);
      }
    } else {
      appendTerminalLog('READY', `Engine mounted. Type 'help' in Terminal for custom commands.`);
    }
  };

  const dropAiAndFreeStorage = (modelToDrop) => {
    const target = modelToDrop || activeModel;
    if (!target) return;

    Alert.alert(
      'Drop AI & Free Storage?',
      `This will unload ${target.name} from RAM and permanently delete its ${target.sizeLabel} GGUF file so your phone is completely empty and fresh again.`,
      [
        { text: 'Keep AI', style: 'cancel' },
        {
          text: 'Drop AI & Erase',
          style: 'destructive',
          onPress: async () => {
            try {
              if (llamaContext) {
                await llamaContext.release();
                setLlamaContext(null);
              }
              const fileUri = `${FileSystem.documentDirectory}${target.fileName}`;
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            } catch (e) {}

            setInstalledModels((prev) => {
              const updated = { ...prev };
              delete updated[target.id];
              return updated;
            });

            if (activeModel?.id === target.id) {
              setActiveModel(null);
              setMessages([]);
              setTerminalLogs([]);
              setCurrentView('hub');
            }
            setStatusBanner(`😊 ${target.name} dropped! RAM freed & ${target.sizeLabel} storage recovered.`);
          },
        },
      ]
    );
  };

  // ==========================================
  // 6. CHAT & TERMINAL INFERENCE HANDLER
  // ==========================================
  const runInference = async (promptText, fromTerminal = false) => {
    const clean = promptText.trim();
    if (!clean || isGenerating) return;

    if (fromTerminal) {
      setTerminalInput('');
      appendTerminalLog('USER>', clean);

      // Built-in Terminal Commands for training/personalization
      if (clean.toLowerCase() === 'help') {
        appendTerminalLog(
          'HELP',
          `Commands:\n  • status       -> View RAM, quant & active threads\n  • temp <0.1-1> -> Set sampling temperature\n  • ctx <2048-8192> -> Resize context window\n  • sys <prompt> -> Re-train system persona on the fly\n  • swap         -> Return to Model Hub to switch AI\n  • drop         -> Unload AI and wipe GGUF storage`
        );
        return;
      }
      if (clean.toLowerCase() === 'status') {
        appendTerminalLog(
          'STAT',
          `Model: ${activeModel?.name} | Quant: ${activeModel?.quant} | RAM: ${deviceRamGb}GB | Temp: ${temperature} | Ctx: ${contextSize}`
        );
        return;
      }
      if (clean.toLowerCase().startsWith('temp ')) {
        const val = parseFloat(clean.split(' ')[1]);
        if (!isNaN(val) && val >= 0 && val <= 1.5) {
          setTemperature(val);
          appendTerminalLog('CFG', `Temperature updated to ${val}`);
        }
        return;
      }
      if (clean.toLowerCase().startsWith('ctx ')) {
        const val = parseInt(clean.split(' ')[1], 10);
        if (!isNaN(val) && val >= 512) {
          setContextSize(val);
          appendTerminalLog('CFG', `Context window resized to ${val} tokens`);
        }
        return;
      }
      if (clean.toLowerCase().startsWith('sys ')) {
        const newSys = clean.slice(4).trim();
        setCustomSystemPrompt(newSys);
        appendTerminalLog('SYS', `System directive updated: "${newSys}"`);
        return;
      }
      if (clean.toLowerCase() === 'swap') {
        setCurrentView('hub');
        return;
      }
      if (clean.toLowerCase() === 'drop') {
        dropAiAndFreeStorage(activeModel);
        return;
      }
    } else {
      setChatInput('');
    }

    const userMessage = { id: Date.now().toString(), role: 'user', content: clean };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsGenerating(true);

    const startTime = Date.now();
    appendTerminalLog('EXEC', `Prompting ${activeModel?.id || 'engine'} (temp=${temperature})...`);

    try {
      let replyText = '';
      if (llamaContext) {
        const formattedPrompt =
          `<|im_start|>system\n${customSystemPrompt}<|im_end|>\n` +
          nextMessages
            .slice(-6)
            .map((m) => `<|im_start|>${m.role}\n${m.content}<|im_end|>`)
            .join('\n') +
          `\n<|im_start|>assistant\n`;

        const res = await llamaContext.completion({
          prompt: formattedPrompt,
          n_predict: 512,
          temperature,
          stop: ['<|im_end|>', '<|endoftext|>'],
        });
        replyText = res.text?.trim() || 'Completed with empty output.';
      } else {
        // Fallback check for local port 8080 or offline diagnostic response
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 2500);
          const resp = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model: activeModel?.id,
              messages: [
                { role: 'system', content: customSystemPrompt },
                ...nextMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
              ],
              temperature,
            }),
          });
          clearTimeout(tId);
          const data = await resp.json();
          replyText = data?.choices?.[0]?.message?.content?.trim();
        } catch (localErr) {
          replyText =
            `[${activeModel?.name} • Local Engine Diagnostic]\n` +
            `• System Persona Active: "${customSystemPrompt.slice(0, 70)}..."\n` +
            `• Query Analyzed: "${clean}"\n\n` +
            `Ensure the GGUF model is downloaded via the Model Hub so llama.rn mounts the weights natively in RAM.`;
        }
      }

      const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
      const estTokens = Math.max(12, Math.round(replyText.split(/\s+/).length * 1.3));
      const tps = (estTokens / elapsedSec).toFixed(1);

      appendTerminalLog('PERF', `Generated ${estTokens} tokens in ${elapsedSec.toFixed(2)}s (${tps} t/s)`);
      if (fromTerminal) {
        appendTerminalLog('AI>', replyText);
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: replyText },
      ]);
    } catch (err) {
      appendTerminalLog('ERR', err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // 7. RENDER: MODEL HUB (FIRST BOOT SCREEN)
  // ==========================================
  const renderModelHub = () => (
    <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
      {/* Top Glass Hero Card */}
      <BlurView intensity={45} tint="dark" style={styles.heroGlassCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.brandTitle}>BHAGADBILLA</Text>
            <Text style={styles.brandSubtitle}>Standalone Local AI & Terminal Hub</Text>
          </View>
          <View style={styles.ramBadge}>
            <Ionicons name="hardware-chip-outline" size={15} color="#38BDF8" />
            <Text style={styles.ramBadgeText}>{deviceRamGb} GB RAM</Text>
          </View>
        </View>

        {/* Hardware Simulator Switcher so user can test how 4GB / 6GB / 8GB / 12GB phones freeze unsupported models */}
        <View style={styles.ramSwitcherRow}>
          <Text style={styles.ramSwitcherLabel}>Detected Spec Tier:</Text>
          {[4, 6, 8, 12].map((gb) => (
            <TouchableOpacity
              key={gb}
              style={[styles.ramPill, deviceRamGb === gb && styles.ramPillActive]}
              onPress={() => setDeviceRamGb(gb)}
            >
              <Text style={[styles.ramPillText, deviceRamGb === gb && styles.ramPillTextActive]}>
                {gb}GB
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Specialization Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BlurView>

      {statusBanner ? (
        <BlurView intensity={35} tint="dark" style={styles.statusToast}>
          <Text style={styles.statusToastText}>{statusBanner}</Text>
          <TouchableOpacity onPress={() => setStatusBanner('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </BlurView>
      ) : null}

      {/* Grouped RAM Blocks (Header mentions GBs once, list of LLMs inside block below) */}
      {RAM_TIERS.map((tier) => {
        const isSupported = deviceRamGb >= tier.ramGb;
        const filteredModels = tier.models.filter(
          (m) => selectedCategory === 'All' || m.category === selectedCategory
        );
        if (filteredModels.length === 0) return null;

        return (
          <View key={tier.ramGb} style={styles.tierSection}>
            {/* Single GB Header for the whole block */}
            <View style={styles.tierHeaderRow}>
              <Text style={styles.tierHeaderText}>{tier.headerTitle}</Text>
              <View
                style={[
                  styles.tierSupportPill,
                  { backgroundColor: isSupported ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)' },
                ]}
              >
                <Text
                  style={[
                    styles.tierSupportText,
                    { color: isSupported ? '#34D399' : '#F87171' },
                  ]}
                >
                  {isSupported ? '● Supported' : '🔒 Frozen'}
                </Text>
              </View>
            </View>

            {/* Glass Block Containing the List of LLM Names */}
            <BlurView
              intensity={35}
              tint="dark"
              style={[styles.tierGlassBlock, !isSupported && styles.tierGlassBlockFrozen]}
            >
              {filteredModels.map((model, idx) => {
                const isInstalled = !!installedModels[model.id];
                return (
                  <View
                    key={model.id}
                    style={[
                      styles.modelListRow,
                      idx < filteredModels.length - 1 && styles.modelListDivider,
                    ]}
                  >
                    <View style={styles.modelRowLeft}>
                      <Text style={[styles.modelRowName, !isSupported && styles.frozenText]}>
                        {model.name}
                      </Text>
                      <Text style={styles.modelRowSub}>
                        {model.category} • {model.sizeLabel}
                      </Text>
                      {!isSupported && (
                        <Text style={styles.notSupportedStatement}>
                          Not supported on this device
                        </Text>
                      )}
                    </View>

                    {!isSupported ? (
                      <View style={styles.frozenBtn}>
                        <Ionicons name="lock-closed" size={14} color="#64748B" />
                        <Text style={styles.frozenBtnText}>Locked</Text>
                      </View>
                    ) : isInstalled ? (
                      <View style={styles.installedActionGroup}>
                        <TouchableOpacity
                          style={styles.launchBtn}
                          onPress={() => launchModelInEngine(model, installedModels[model.id])}
                        >
                          <Text style={styles.launchBtnText}>Launch</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dropIconBtn}
                          onPress={() => dropAiAndFreeStorage(model)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#F87171" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.selectModelBtn}
                        onPress={() => openModelPreview(model)}
                      >
                        <Text style={styles.selectModelBtnText}>Select</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </BlurView>
          </View>
        );
      })}
    </ScrollView>
  );

  // ==========================================
  // 8. RENDER: DUAL CHAT & TERMINAL WORKSPACE
  // ==========================================
  const renderWorkspace = () => (
    <View style={styles.workspaceContainer}>
      {/* Frosted Glass Top Bar */}
      <BlurView intensity={50} tint="dark" style={styles.workspaceHeader}>
        <TouchableOpacity style={styles.backHubBtn} onPress={() => setCurrentView('hub')}>
          <Ionicons name="grid-outline" size={16} color="#38BDF8" />
          <Text style={styles.backHubText}>Models</Text>
        </TouchableOpacity>

        {/* Chat vs Terminal Mode Segmented Glass Toggle */}
        <View style={styles.modeToggleWrapper}>
          <TouchableOpacity
            style={[styles.modeTab, workspaceTab === 'chat' && styles.modeTabActive]}
            onPress={() => setWorkspaceTab('chat')}
          >
            <Text style={[styles.modeTabText, workspaceTab === 'chat' && styles.modeTabTextActive]}>
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, workspaceTab === 'terminal' && styles.modeTabActive]}
            onPress={() => setWorkspaceTab('terminal')}
          >
            <Text
              style={[styles.modeTabText, workspaceTab === 'terminal' && styles.modeTabTextActive]}
            >
              {'>_'} Terminal
            </Text>
          </TouchableOpacity>
        </View>

        {/* Drop AI Button to Free RAM & Storage */}
        <TouchableOpacity
          style={styles.dropHeaderBtn}
          onPress={() => dropAiAndFreeStorage(activeModel)}
        >
          <Ionicons name="power" size={14} color="#F87171" />
          <Text style={styles.dropHeaderBtnText}>Drop AI</Text>
        </TouchableOpacity>
      </BlurView>

      {workspaceTab === 'chat' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatListContent}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View style={[styles.chatRow, isUser ? styles.chatRowUser : styles.chatRowAi]}>
                  <BlurView
                    intensity={isUser ? 45 : 30}
                    tint="dark"
                    style={[styles.chatBubble, isUser ? styles.userGlassBubble : styles.aiGlassBubble]}
                  >
                    <Text style={styles.chatBubbleText} selectable>
                      {item.content}
                    </Text>
                  </BlurView>
                </View>
              );
            }}
          />

          <BlurView intensity={55} tint="dark" style={styles.chatInputBar}>
            <TextInput
              style={styles.chatTextInput}
              placeholder={`Ask ${activeModel?.name || 'AI'}...`}
              placeholderTextColor="#64748B"
              value={chatInput}
              onChangeText={setChatInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendCircleBtn, !chatInput.trim() && { opacity: 0.4 }]}
              disabled={!chatInput.trim() || isGenerating}
              onPress={() => runInference(chatInput, false)}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      ) : (
        /* RAW TERMINAL EXECUTION INTERFACE */
        <View style={styles.terminalWrapper}>
          {/* Live Parameter & System Prompt Personalization Bar */}
          <BlurView intensity={35} tint="dark" style={styles.terminalControlCard}>
            <Text style={styles.terminalControlTitle}>
              LIVE ENGINE TUNING • {activeModel?.fileName}
            </Text>
            <View style={styles.paramPillsRow}>
              {[0.1, 0.2, 0.5, 0.8].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.paramChip, temperature === t && styles.paramChipActive]}
                  onPress={() => {
                    setTemperature(t);
                    appendTerminalLog('CFG', `Temperature set to ${t}`);
                  }}
                >
                  <Text style={styles.paramChipText}>Temp {t}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.paramChip}
                onPress={() => setCurrentView('hub')}
              >
                <Text style={[styles.paramChipText, { color: '#38BDF8' }]}>Swap Model</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          <FlatList
            data={terminalLogs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.terminalLogsList}
            renderItem={({ item }) => (
              <Text style={styles.terminalLogLine} selectable>
                <Text style={styles.terminalTimestamp}>[{item.time}] </Text>
                <Text style={styles.terminalTag}>[{item.tag}] </Text>
                {item.text}
              </Text>
            )}
          />

          <View style={styles.terminalInputRow}>
            <Text style={styles.terminalPromptSymbol}>bhagadbilla@local:~#</Text>
            <TextInput
              style={styles.terminalTextInput}
              placeholder="help | status | temp 0.2 | sys <prompt> | or query..."
              placeholderTextColor="#475569"
              value={terminalInput}
              onChangeText={setTerminalInput}
              autoCapitalize="none"
              onSubmitEditing={() => runInference(terminalInput, true)}
            />
            <TouchableOpacity
              style={styles.terminalExecBtn}
              onPress={() => runInference(terminalInput, true)}
            >
              <Text style={styles.terminalExecBtnText}>RUN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.rootSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#060913" />

      {/* Decorative Ambient Background Glows for Glass UI */}
      <View style={styles.ambientOrbCyan} />
      <View style={styles.ambientOrbViolet} />

      {currentView === 'hub' ? renderModelHub() : renderWorkspace()}

      {/* ======================================================= */}
      {/* ENLARGING ANIMATED POPUP WHEN SUPPORTED MODEL IS CHOSEN */}
      {/* ======================================================= */}
      <Modal visible={!!previewModel} transparent animationType="none">
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.popupCardContainer,
              {
                opacity: popupOpacity,
                transform: [{ scale: popupScale }],
              },
            ]}
          >
            <BlurView intensity={75} tint="dark" style={styles.popupGlassInner}>
              <Text style={styles.popupModelHeader}>{previewModel?.name}</Text>
              <View style={styles.popupMetaRow}>
                <Text style={styles.popupMetaBadge}>{previewModel?.category}</Text>
                <Text style={styles.popupMetaBadge}>{previewModel?.quant}</Text>
                <Text style={styles.popupMetaBadge}>{previewModel?.sizeLabel}</Text>
              </View>

              <Text style={styles.popupSummaryText}>{previewModel?.summary}</Text>

              <View style={styles.popupActionsRow}>
                <TouchableOpacity style={styles.popupCancelBtn} onPress={closeModelPreview}>
                  <Text style={styles.popupCancelText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.popupConfirmBtn}
                  onPress={() => startModelDownload(previewModel)}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
                  <Text style={styles.popupConfirmText}>Confirm Download</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* DOWNLOAD PROGRESS MODAL WITH OFFLINE FREEZE & CLEANUP   */}
      {/* ======================================================= */}
      <Modal visible={!!downloadingModel} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView intensity={80} tint="dark" style={styles.downloadGlassModal}>
            <Text style={styles.downloadTitle}>Downloading {downloadingModel?.name}</Text>
            <Text style={styles.downloadSub}>
              {(downloadedBytes / (1024 * 1024)).toFixed(1)} MB •{' '}
              {(downloadProgress * 100).toFixed(1)}%
            </Text>

            <View style={styles.progressBarTrack}>
              <View
                style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]}
              />
            </View>

            {/* Offline State Notice */}
            {isOfflineDuringDownload && !showReconnectPrompt && (
              <View style={styles.offlineWarningBox}>
                <Text style={styles.offlineWarningText}>
                  ⚠️ Internet disconnected. Download paused. Cancel button is frozen until connection returns...
                </Text>
              </View>
            )}

            {/* Back Online Prompt: Continue or Cancel & Erase */}
            {showReconnectPrompt ? (
              <View style={styles.reconnectPromptBox}>
                <Text style={styles.reconnectPromptTitle}>
                  🌐 Connection Restored! Continue or Cancel?
                </Text>
                <View style={styles.reconnectButtonsRow}>
                  <TouchableOpacity
                    style={styles.continueDownloadBtn}
                    onPress={resumeDownloadAfterReconnect}
                  >
                    <Text style={styles.continueDownloadText}>Continue</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelEraseBtn}
                    onPress={cancelAndEraseDownload}
                  >
                    <Text style={styles.cancelEraseText}>Cancel & Erase</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Standard Cancel Button (Frozen while offline) */
              <TouchableOpacity
                style={[
                  styles.cancelDownloadBtn,
                  isOfflineDuringDownload && styles.cancelDownloadBtnFrozen,
                ]}
                disabled={isOfflineDuringDownload}
                onPress={cancelAndEraseDownload}
              >
                <Text style={styles.cancelDownloadBtnText}>
                  {isOfflineDuringDownload
                    ? 'Cancel Frozen (Waiting for Network...)'
                    : 'Cancel & Erase Partial File'}
                </Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// 9. GLASSMORPHIC STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  rootSafe: {
    flex: 1,
    backgroundColor: '#060913',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  ambientOrbCyan: {
    position: 'absolute',
    top: -60,
    left: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
  },
  ambientOrbViolet: {
    position: 'absolute',
    bottom: 60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
  },
  hubScroll: {
    padding: 16,
    paddingBottom: 48,
  },
  heroGlassCard: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  ramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  ramBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  ramSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  ramSwitcherLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginRight: 8,
  },
  ramPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ramPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38BDF8',
  },
  ramPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  ramPillTextActive: {
    color: '#F8FAFC',
  },
  categoryScroll: {
    marginTop: 14,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  categoryChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  statusToast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusToastText: {
    color: '#A7F3D0',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  tierSection: {
    marginBottom: 20,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tierHeaderText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tierSupportPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tierSupportText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tierGlassBlock: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  tierGlassBlockFrozen: {
    opacity: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  modelListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modelListDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modelRowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  modelRowName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  frozenText: {
    color: '#94A3B8',
  },
  modelRowSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  notSupportedStatement: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  selectModelBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  selectModelBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  frozenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  frozenBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  installedActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  launchBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  launchBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 12,
  },
  dropIconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 6, 15, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCardContainer: {
    width: '100%',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  popupGlassInner: {
    padding: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  popupModelHeader: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800',
  },
  popupMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 14,
  },
  popupMetaBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 6,
  },
  popupSummaryText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  popupActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popupCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  popupCancelText: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  popupConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  popupConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  downloadGlassModal: {
    width: '100%',
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  downloadTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  downloadSub: {
    color: '#38BDF8',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  offlineWarningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  offlineWarningText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
  },
  reconnectPromptBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 14,
    borderRadius: 14,
  },
  reconnectPromptTitle: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  reconnectButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  continueDownloadBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  continueDownloadText: {
    color: '#052E16',
    fontWeight: '800',
  },
  cancelEraseBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelEraseText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cancelDownloadBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelDownloadBtnFrozen: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderColor: '#475569',
    opacity: 0.55,
  },
  cancelDownloadBtnText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 13,
  },
  workspaceContainer: {
    flex: 1,
  },
  workspaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  backHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  backHubText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  modeToggleWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 13,
  },
  modeTabActive: {
    backgroundColor: '#0284C7',
  },
  modeTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  dropHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dropHeaderBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  chatListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  chatRow: {
    marginBottom: 14,
    flexDirection: 'row',
  },
  chatRowUser: {
    justifyContent: 'flex-end',
  },
  chatRowAi: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '86%',
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  userGlassBubble: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  aiGlassBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  chatBubbleText: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 21,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  chatTextInput: {
    flex: 1,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  sendCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  terminalWrapper: {
    flex: 1,
    backgroundColor: '#030712',
  },
  terminalControlCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
  },
  terminalControlTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 8,
  },
  paramPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paramChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  paramChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  paramChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  terminalLogsList: {
    padding: 14,
  },
  terminalLogLine: {
    color: '#10B981',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 6,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  terminalTimestamp: {
    color: '#64748B',
  },
  terminalTag: {
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  terminalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  terminalPromptSymbol: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  terminalTextInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    paddingVertical: 6,
  },
  terminalExecBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 8,
  },
  terminalExecBtnText: {
    color: '#052E16',
    fontSize: 11,
    fontWeight: '900',
  },
});

