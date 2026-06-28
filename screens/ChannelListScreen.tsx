import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChannelsFromDb } from '../db';
import { globalStyles, colors } from '../styles/globalStyles';

export default function ChannelListScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { playlistId, name } = route.params;

    const [channels, setChannels] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        console.log(`[ChannelList] Screen mounted for playlistId=${playlistId}`);
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        if (loading || !hasMore) return;
        console.log(`[ChannelList] Fetching channels page ${page}...`);
        setLoading(true);
        try {
            const data = await getChannelsFromDb(playlistId, page);
            console.log(`[ChannelList] Received ${data.length} channels`);
            if (data.length > 0) {
                setChannels(prev => [...prev, ...data]);
                setPage(prev => prev + 1);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity 
            style={styles.channelItem}
            onPress={() => {
                console.log(`[ChannelList] Navigating to Player for channel: ${item.name}`);
                navigation.navigate('Player', { streamUrl: item.streamUrl, title: item.name, tvgId: item.tvgId, playlistId });
            }}
        >
            <View style={styles.channelRow}>
                {item.logoUrl ? (
                    <Image source={{ uri: item.logoUrl }} style={styles.logo} resizeMode="contain" />
                ) : (
                    <View style={styles.placeholderLogo}>
                        <Text style={styles.placeholderText}>{item.name.substring(0, 2)}</Text>
                    </View>
                )}
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    {item.tvgName ? <Text style={styles.subName}>{item.tvgName}</Text> : null}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={globalStyles.backButton}>
                    <Text style={globalStyles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={globalStyles.titleText} numberOfLines={1}>{name}</Text>
            </View>

            <FlatList
                data={channels}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={renderItem}
                onEndReached={fetchChannels}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 20 }} color="#6c5ce7" /> : null}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    channelItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: colors.input },
    channelRow: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 50, height: 50, borderRadius: 8, marginRight: 15, backgroundColor: colors.text },
    placeholderLogo: { width: 50, height: 50, borderRadius: 8, marginRight: 15, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
    placeholderText: { color: colors.textMuted, fontWeight: 'bold', fontSize: 18 },
    info: { flex: 1 },
    name: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
    subName: { color: colors.textMuted, fontSize: 14, marginTop: 4 }
});
