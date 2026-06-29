import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getEpgForChannel } from '../db';
import { NativePlayerView, VlcPlayerView, needsVlc } from './VideoPlayers';

export default function PlayerScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { streamUrl, title, tvgId, playlistId } = route.params;
    const insets = useSafeAreaInsets();

    const useVlc = needsVlc(streamUrl);

    const [epgData, setEpgData] = useState<any[]>([]);
    const [showEpg, setShowEpg] = useState(false);
    const [immersive, setImmersive] = useState(false);
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        ScreenOrientation.lockAsync(
            immersive ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(console.warn);
    }, [immersive]);

    useEffect(() => () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); }, []);

    useEffect(() => {
        if (tvgId && playlistId) {
            getEpgForChannel(playlistId, tvgId).then(data => {
                setEpgData(data);
            }).catch(console.error);
        }
    }, [tvgId, playlistId]);

    const formatXmltvDate = (dateStr: string) => {
        if (!dateStr) return '';
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*(.*)$/);
        if (match) {
            const [_, year, month, day, hour, min, sec, tz] = match;
            const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}${tz || 'Z'}`;
            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return dateStr;
    };

    const toggleEpg = () => {
        if (showEpg) {
            Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => setShowEpg(false));
        } else {
            setShowEpg(true);
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {!immersive && (
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={10}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {epgData.length > 0 && (
                        <TouchableOpacity onPress={toggleEpg} style={styles.epgButton}>
                            <Text style={styles.epgButtonText}>TV Guide</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <View style={styles.playerContainer}>
                {useVlc ? (
                    <VlcPlayerView streamUrl={streamUrl} onToggleImmersive={() => setImmersive(v => !v)} />
                ) : (
                    <NativePlayerView streamUrl={streamUrl} />
                )}
            </View>

            {showEpg && !immersive && (
                <Animated.View style={[styles.epgOverlay, { transform: [{ translateY: slideAnim }] }]}>
                    <Text style={styles.epgTitle}>Upcoming Programs</Text>
                    <FlatList
                        data={epgData}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <View style={styles.epgItem}>
                                <Text style={styles.epgTime}>
                                    {formatXmltvDate(item.startTime)} - {formatXmltvDate(item.endTime)}
                                </Text>
                                <Text style={styles.epgProgramTitle}>{item.title}</Text>
                                {item.description ? <Text style={styles.epgDesc} numberOfLines={2}>{item.description}</Text> : null}
                            </View>
                        )}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={toggleEpg}>
                        <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, position: 'absolute', top: 0, zIndex: 10, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
    backButton: { marginRight: 15 },
    backText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
    epgButton: { backgroundColor: '#6c5ce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    epgButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    playerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    epgOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '50%', backgroundColor: '#1c1c21', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
    epgTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    epgItem: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#2a2a35', paddingBottom: 10 },
    epgTime: { color: '#a29bfe', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    epgProgramTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    epgDesc: { color: '#888', fontSize: 13, marginTop: 4 },
    closeBtn: { marginTop: 10, padding: 15, backgroundColor: '#2a2a35', borderRadius: 10, alignItems: 'center' },
    closeBtnText: { color: '#fff', fontWeight: 'bold' }
});
