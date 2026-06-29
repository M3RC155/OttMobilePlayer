import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { initDb, addPlaylistToDb, getPlaylistsFromDb, deletePlaylistFromDb, setPlaylistError, updatePlaylistInDb } from '../db';
import { parsePlaylistBackground } from '../parser';
import { Alert } from 'react-native';
import { globalStyles, colors } from '../styles/globalStyles';

export default function HomeScreen() {
    const [loginMode, setMode] = useState<'m3u' | 'xtream'>('m3u');

    // M3U State
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [epgUrl, setEpgUrl] = useState('');

    // Xtream State
    const [host, setHost] = useState('');
    const [port, setPort] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [playlists, setPlaylists] = useState<any[]>([]);

    // Edit State
    const [editingPlaylist, setEditingPlaylist] = useState<any>(null);
    const [editName, setEditName] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editEpgUrl, setEditEpgUrl] = useState('');

    const navigation = useNavigation<any>();

    useEffect(() => {
        initDb().then(loadPlaylists);
        const interval = setInterval(loadPlaylists, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadPlaylists = async () => {
        try {
            const data = await getPlaylistsFromDb();
            setPlaylists(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddM3u = async () => {
        if (!url || !name) return;

        let validUrl = url.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            Alert.alert('Error', 'M3U URL must start with http:// or https://');
            return;
        }

        let validEpgUrl = epgUrl.trim();
        if (validEpgUrl && !validEpgUrl.startsWith('http://') && !validEpgUrl.startsWith('https://')) {
            Alert.alert('Error', 'EPG URL must start with http:// or https://');
            return;
        }

        setLoading(true);
        try {
            const playlistId = await addPlaylistToDb(name, validUrl, validEpgUrl);
            await loadPlaylists();
            setUrl(''); setName(''); setEpgUrl('');

            // Kick off background parsing (don't await it so UI isn't blocked)
            parsePlaylistBackground(playlistId, validUrl);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to add playlist');
        } finally {
            setLoading(false);
        }
    };

    const handleAddXtream = async () => {
        if (!host || !username || !password) {
            Alert.alert('Error', 'Please fill in host, username, and password');
            return;
        }

        setLoading(true);

        try {
            let baseUrl = host.trim();
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                Alert.alert('Error', 'Host URL must start with http:// or https://');
                setLoading(false);
                return;
            }

            if (baseUrl.endsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }
            if (port) {
                baseUrl = `${baseUrl}:${port.trim()}`;
            }

            const creds = `username=${username.trim()}&password=${password.trim()}`;
            const xtreamApiUrl = `${baseUrl}/player_api.php?${creds}`;
            const xtreamEpgUrl = `${baseUrl}/xmltv.php?${creds}`;
            const playlistName = `Xtream: ${baseUrl}`;

            const playlistId = await addPlaylistToDb(playlistName, xtreamApiUrl, xtreamEpgUrl);
            await loadPlaylists();

            setHost(''); setPort(''); setUsername(''); setPassword('');

            parsePlaylistBackground(playlistId, xtreamApiUrl);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to add Xtream playlist');
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async (item: any) => {
        await setPlaylistError(item.id, null as any); // Clear error
        await loadPlaylists();
        parsePlaylistBackground(item.id, item.url);
    };

    const handleDelete = async (id: number) => {
        Alert.alert('Delete Playlist', 'Are you sure you want to delete this playlist?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deletePlaylistFromDb(id);
                    await loadPlaylists();
                }
            }
        ]);
    };

    const handleEditSave = async () => {
        if (!editingPlaylist || !editName || !editUrl) return;

        let validUrl = editUrl.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            Alert.alert('Error', 'M3U URL must start with http:// or https://');
            return;
        }

        try {
            await updatePlaylistInDb(editingPlaylist.id, editName, validUrl, editEpgUrl);
            setEditingPlaylist(null);
            await loadPlaylists();
            // Re-trigger parse
            parsePlaylistBackground(editingPlaylist.id, validUrl);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update playlist');
        }
    };

    const swipeLeftEdit = (item: any) => (
        <View style={{ flexDirection: 'row', height: '100%' }}>
            <TouchableOpacity
                style={{ backgroundColor: '#0984e3', justifyContent: 'center', paddingHorizontal: 25 }}
                onPress={() => {
                    setEditingPlaylist(item);
                    setEditName(item.name);
                    setEditUrl(item.url);
                    setEditEpgUrl(item.epgUrl || '');
                }}
            >
                <Text style={globalStyles.buttonText}>Edit</Text>
            </TouchableOpacity>
        </View>
    );

    const swipeRightDelete = (item: any) => (
        <View style={{ flexDirection: 'row', height: '100%' }}>
            <TouchableOpacity
                style={{ backgroundColor: '#d63031', justifyContent: 'center', paddingHorizontal: 25 }}
                onPress={() => handleDelete(item.id)}
            >
                <Text style={globalStyles.buttonText}>Delete</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={globalStyles.containerPadded}>
            <Text style={styles.title}>OTT Player</Text>

            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'm3u' && styles.toggleActive]}
                    onPress={() => setMode('m3u')}>
                    <Text style={[styles.toggleText, loginMode === 'm3u' && styles.toggleTextActive]}>M3U Playlist</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'xtream' && styles.toggleActive]}
                    onPress={() => setMode('xtream')}>
                    <Text style={[styles.toggleText, loginMode === 'xtream' && styles.toggleTextActive]}>Xtream API</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={[globalStyles.card, { flexGrow: 0, marginBottom: 20 }]}>
                {loginMode === 'm3u' ? (
                    <>
                        <TextInput style={globalStyles.input} placeholder="Playlist Name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
                        <TextInput style={globalStyles.input} placeholder="M3U/M3U8 URL" placeholderTextColor={colors.textMuted} value={url} onChangeText={setUrl} autoCapitalize="none" />
                        <TextInput style={globalStyles.input} placeholder="EPG XMLTV URL (Optional)" placeholderTextColor={colors.textMuted} value={epgUrl} onChangeText={setEpgUrl} autoCapitalize="none" />
                        <TouchableOpacity style={globalStyles.button} onPress={handleAddM3u} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={globalStyles.buttonText}>Parse M3U</Text>}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TextInput style={globalStyles.input} placeholder="Host URL (e.g. http://domain.com)" placeholderTextColor={colors.textMuted} value={host} onChangeText={setHost} autoCapitalize="none" />
                        <TextInput style={globalStyles.input} placeholder="Port" placeholderTextColor={colors.textMuted} value={port} onChangeText={setPort} keyboardType="numeric" />
                        <TextInput style={globalStyles.input} placeholder="Username" placeholderTextColor={colors.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" />
                        <TextInput style={globalStyles.input} placeholder="Password" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
                        <TouchableOpacity style={globalStyles.button} onPress={handleAddXtream} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={globalStyles.buttonText}>Login to Xtream</Text>}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            <Text style={globalStyles.sectionTitle}>Your Playlists</Text>
            <FlatList
                data={playlists}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <Swipeable
                        containerStyle={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden' }}
                        renderLeftActions={() => swipeLeftEdit(item)}
                        renderRightActions={() => swipeRightDelete(item)}
                    >
                        <TouchableOpacity
                            style={[styles.playlistItem, { marginBottom: 0, borderRadius: 0 }]}
                            onPress={() => item.isParsed && !item.error && navigation.navigate('Channels', { playlistId: item.id, name: item.name })}
                            disabled={!!item.error || !item.isParsed}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.playlistName}>{item.name}</Text>
                                <Text style={item.error ? styles.playlistError : styles.playlistStatus}>
                                    {item.error ? `❌ ${item.error}` : (item.isParsed ? "✅ Ready to Watch" : "⏳ Syncing in background...")}
                                </Text>
                                {item.error ? (
                                    <View style={globalStyles.errorActions}>
                                        <TouchableOpacity style={globalStyles.retryButton} onPress={() => handleRetry(item)}>
                                            <Text style={globalStyles.actionText}>Retry</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={globalStyles.deleteButton} onPress={() => handleDelete(item.id)}>
                                            <Text style={globalStyles.actionText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    </Swipeable>
                )}
                ListEmptyComponent={<Text style={globalStyles.emptyText}>No playlists added yet.</Text>}
            />

            {/* Edit Modal */}
            <Modal visible={!!editingPlaylist} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={globalStyles.sectionTitle}>Edit Playlist</Text>
                        <TextInput style={globalStyles.input} placeholder="Playlist Name" placeholderTextColor={colors.textMuted} value={editName} onChangeText={setEditName} />
                        <TextInput style={globalStyles.input} placeholder="M3U/M3U8 URL" placeholderTextColor={colors.textMuted} value={editUrl} onChangeText={setEditUrl} autoCapitalize="none" />
                        <TextInput style={globalStyles.input} placeholder="EPG XMLTV URL" placeholderTextColor={colors.textMuted} value={editEpgUrl} onChangeText={setEditEpgUrl} autoCapitalize="none" />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity style={[globalStyles.button, { flex: 1, backgroundColor: colors.input }]} onPress={() => setEditingPlaylist(null)}>
                                <Text style={globalStyles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[globalStyles.button, { flex: 1 }]} onPress={handleEditSave}>
                                <Text style={globalStyles.buttonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 15, marginTop: 10 },
    toggleContainer: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 15 },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleActive: { backgroundColor: colors.primary },
    toggleText: { color: colors.textMuted, fontWeight: 'bold' },
    toggleTextActive: { color: colors.text },
    playlistItem: { backgroundColor: colors.card, padding: 20, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    playlistName: { color: colors.text, fontSize: 18, fontWeight: '600' },
    playlistStatus: { color: colors.primaryLight, fontSize: 14, marginTop: 5 },
    playlistError: { color: '#ff7675', fontSize: 14, marginTop: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.background, padding: 20, borderRadius: 16 }
});
