import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, Animated } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEpgForChannel } from '../db';

export default function PlayerScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { streamUrl, title, tvgId, playlistId } = route.params;
    console.log(`[Player] Initializing for streamUrl=${streamUrl}, title=${title}`);
    const player = useVideoPlayer(streamUrl, player => {
        console.log(`[Player] Starting playback for ${title}`);
        player.play();
    });

    const [epgData, setEpgData] = useState<any[]>([]);
    const [showEpg, setShowEpg] = useState(false);
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (tvgId && playlistId) {
            getEpgForChannel(playlistId, tvgId).then(data => {
                setEpgData(data);
                console.log(`[Player] Loaded ${data.length} EPG items for tvgId=${tvgId}`);
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
        console.log(`[Player] Toggling EPG: showEpg will be ${!showEpg}`);
        if (showEpg) {
            Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => setShowEpg(false));
        } else {
            setShowEpg(true);
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {epgData.length > 0 && (
                    <TouchableOpacity onPress={toggleEpg} style={styles.epgButton}>
                        <Text style={styles.epgButtonText}>TV Guide</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.playerContainer}>
                <VideoView
                    style={styles.video}
                    player={player}
                />
            </View>

            {showEpg && (
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
    video: { width: '100%', height: '100%' },
    epgOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '50%', backgroundColor: '#1c1c21', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
    epgTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    epgItem: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#2a2a35', paddingBottom: 10 },
    epgTime: { color: '#a29bfe', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    epgProgramTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    epgDesc: { color: '#888', fontSize: 13, marginTop: 4 },
    closeBtn: { marginTop: 10, padding: 15, backgroundColor: '#2a2a35', borderRadius: 10, alignItems: 'center' },
    closeBtnText: { color: '#fff', fontWeight: 'bold' }
});
