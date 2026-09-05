import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Phone,
} from 'lucide-react-native';
import { openWhatsApp, type ReminderTone } from '../lib/whatsapp';
import { useReadableContentWidth } from '../lib/layout';

interface WhatsAppMessageModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  clientName: string;
  initialPhone?: string | null;
  publicUrl: string;
  initialMessage: string;
  mode?: 'share' | 'reminder';
  onToneChange?: (tone: ReminderTone) => string;
}

export function WhatsAppMessageModal({
  visible,
  onClose,
  title,
  clientName,
  initialPhone,
  publicUrl,
  initialMessage,
  mode = 'share',
  onToneChange,
}: WhatsAppMessageModalProps) {
  const contentStyle = useReadableContentWidth(560);
  const [message, setMessage] = useState(initialMessage);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [selectedTone, setSelectedTone] = useState<ReminderTone>('friendly');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Sync state whenever modal opens or initialMessage changes
  useEffect(() => {
    if (visible) {
      setMessage(initialMessage);
      setPhone(initialPhone ?? '');
      setSelectedTone('friendly');
      setCopiedLink(false);
      setCopiedMessage(false);
    }
  }, [visible, initialMessage, initialPhone]);

  const handleToneSelect = (tone: ReminderTone) => {
    setSelectedTone(tone);
    if (onToneChange) {
      const newMsg = onToneChange(tone);
      setMessage(newMsg);
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = async () => {
    await Clipboard.setStringAsync(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleTestInBrowser = async () => {
    try {
      await Linking.openURL(publicUrl);
    } catch (e) {
      console.warn('Could not open public invoice URL:', e);
    }
  };

  const handleSendWhatsApp = async () => {
    setIsSending(true);
    try {
      await openWhatsApp({ phone: phone.trim() || undefined, text: message });
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end sm:justify-center items-center">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full"
          style={contentStyle}
        >
          <SafeAreaView className="bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-border max-h-[90vh] overflow-hidden">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-border">
              <View className="flex-1 pr-2">
                <Text className="text-lg font-bold text-neutral-900 dark:text-white" numberOfLines={1}>
                  {title}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  Recipient: <Text className="font-semibold text-neutral-800 dark:text-neutral-200">{clientName}</Text>
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center active:bg-neutral-200"
              >
                <X size={18} color="#9E9E9E" />
              </Pressable>
            </View>

            <ScrollView className="px-6 py-4" keyboardShouldPersistTaps="handled">
              {/* Recipient Phone Input */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                  WhatsApp Phone Number
                </Text>
                <View className="flex-row items-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-border rounded-xl px-3.5 h-11">
                  <Phone size={16} color="#9E9E9E" />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. 9876543210 (or leave blank to pick contact)"
                    placeholderTextColor="#737373"
                    keyboardType="phone-pad"
                    className="flex-1 ml-2.5 text-sm text-neutral-900 dark:text-white"
                  />
                </View>
              </View>

              {/* Tone Switcher for Reminders */}
              {mode === 'reminder' && onToneChange ? (
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      Select Reminder Tone
                    </Text>
                    <Sparkles size={13} color="#FF7A00" />
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleToneSelect('friendly')}
                      className={`flex-1 py-2 px-2.5 rounded-xl border items-center justify-center ${
                        selectedTone === 'friendly'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          selectedTone === 'friendly' ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        Friendly
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleToneSelect('gentle')}
                      className={`flex-1 py-2 px-2.5 rounded-xl border items-center justify-center ${
                        selectedTone === 'gentle'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          selectedTone === 'gentle' ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        Gentle
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleToneSelect('firm')}
                      className={`flex-1 py-2 px-2.5 rounded-xl border items-center justify-center ${
                        selectedTone === 'firm'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          selectedTone === 'firm' ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        Firm / Overdue
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Editable Message Text Area */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Message Preview (Editable)
                  </Text>
                  <Pressable
                    onPress={() => setMessage(initialMessage)}
                    className="flex-row items-center py-0.5 px-1.5 rounded"
                  >
                    <RotateCcw size={12} color="#737373" />
                    <Text className="text-xs text-neutral-500 ml-1">Reset</Text>
                  </Pressable>
                </View>

                <View className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-border rounded-2xl p-3.5">
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    className="text-sm text-neutral-900 dark:text-white min-h-[160px] leading-5 font-normal"
                    placeholder="Type your WhatsApp message..."
                    placeholderTextColor="#737373"
                  />
                </View>
                <Text className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                  The invoice link will appear as a clickable blue link in the client&apos;s WhatsApp.
                </Text>
              </View>

              {/* Utility Action Buttons */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                <Pressable
                  onPress={handleTestInBrowser}
                  className="flex-row items-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl active:bg-neutral-200"
                >
                  <ExternalLink size={14} color="#737373" />
                  <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300 ml-1.5">
                    Test in Browser
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCopyLink}
                  className="flex-row items-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl active:bg-neutral-200"
                >
                  {copiedLink ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#737373" />}
                  <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300 ml-1.5">
                    {copiedLink ? 'Link Copied!' : 'Copy Link'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCopyMessage}
                  className="flex-row items-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl active:bg-neutral-200"
                >
                  {copiedMessage ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#737373" />}
                  <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300 ml-1.5">
                    {copiedMessage ? 'Message Copied!' : 'Copy Message'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="px-6 py-4 border-t border-neutral-200 dark:border-border bg-neutral-50/50 dark:bg-card/50">
              <Pressable
                onPress={handleSendWhatsApp}
                disabled={isSending}
                className="h-13 py-3.5 rounded-xl bg-emerald-600 active:bg-emerald-700 items-center justify-center flex-row shadow-sm"
              >
                <MessageCircle size={20} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  {isSending ? 'Opening WhatsApp…' : 'Open WhatsApp & Send'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
