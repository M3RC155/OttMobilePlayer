import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { VLCPlayer } from 'react-native-vlc-media-player';

type Fit = 'contain' | 'cover' | 'fill';
const nextFit = (f: Fit): Fit => (f === 'contain' ? 'cover' : f === 'cover' ? 'fill' : 'contain');

// Pick the right player. iOS AVPlayer (expo-video) only handles HLS + progressive mp4/mov;
// anything else (raw MPEG-TS, mkv, rtsp, ...) goes to VLC, which decodes it on iOS.
export const needsVlc = (url: string) => !/\.(m3u8|mp4|mov|m4v)(\?|#|$)/i.test(url);

const AspectButton = ({ fit, onPress }: { fit: Fit; onPress: () => void }) => (
    <TouchableOpacity style={styles.aspectButton} onPress={onPress}>
        <Text style={styles.smallText}>{fit.toUpperCase()}</Text>
    </TouchableOpacity>
);

const ErrorOverlay = ({ msg, onRetry }: { msg: string; onRetry: () => void }) => (
    <View style={styles.errorOverlay}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{msg}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.smallText}>Retry</Text>
        </TouchableOpacity>
    </View>
);

export function NativePlayerView({ streamUrl }: { streamUrl: string }) {
    const player = useVideoPlayer(streamUrl, p => p.play());
    const [error, setError] = useState<string | null>(null);
    const [fit, setFit] = useState<Fit>('contain');

    useEffect(() => {
        const sub = player.addListener('statusChange', ({ status, error }) => {
            if (status === 'error') setError(error?.message || 'This stream could not be played.');
            else if (status === 'readyToPlay') setError(null);
        });
        return () => sub.remove();
    }, [player]);

    const retry = () => {
        setError(null);
        try { player.replace(streamUrl); player.play(); } catch (e) { console.error(e); }
    };

    return (
        <View style={styles.fill}>
            <VideoView style={styles.fill} player={player} contentFit={fit} />
            <AspectButton fit={fit} onPress={() => setFit(nextFit)} />
            {error && <ErrorOverlay msg={error} onRetry={retry} />}
        </View>
    );
}

// Everything else (raw MPEGTS, mkv, rtsp...) — VLC with hand-built controls.
export function VlcPlayerView({ streamUrl, onToggleImmersive }: { streamUrl: string; onToggleImmersive?: () => void }) {
    const ref = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const [fit, setFit] = useState<Fit>('contain');
    const [seekable, setSeekable] = useState(false);
    const [position, setPosition] = useState(0); // 0..1
    const [reloadKey, setReloadKey] = useState(0);
    const [barWidth, setBarWidth] = useState(0);

    const retry = () => { setError(null); setPaused(false); setReloadKey(k => k + 1); };

    return (
        <View style={styles.fill}>
            <VLCPlayer
                key={reloadKey}
                ref={ref}
                style={styles.fill}
                source={{ uri: streamUrl }}
                paused={paused}
                resizeMode={fit}
                onError={() => setError('This stream could not be played.')}
                onPlaying={(e: any) => { setError(null); setSeekable(!!e?.seekable); }}
                onProgress={(e: any) => setPosition(e?.position || 0)}
            />

            <AspectButton fit={fit} onPress={() => setFit(nextFit)} />
            {onToggleImmersive && (
                <TouchableOpacity style={styles.fsButton} onPress={onToggleImmersive}>
                    <Text style={styles.smallText}>⛶</Text>
                </TouchableOpacity>
            )}

            <View style={styles.controlBar}>
                <TouchableOpacity style={styles.playBtn} onPress={() => setPaused(p => !p)}>
                    <Text style={styles.playIcon}>{paused ? '▶' : '⏸'}</Text>
                </TouchableOpacity>
                {/* Seek only for VOD (seekable). Live streams hide the bar. */}
                {seekable && (
                    <View
                        style={styles.seekTrack}
                        onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
                        onStartShouldSetResponder={() => true}
                        onResponderRelease={e => {
                            if (barWidth > 0) {
                                const pos = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
                                ref.current?.seek(pos);
                                setPosition(pos);
                            }
                        }}
                    >
                        <View style={[styles.seekFill, { width: `${Math.round(position * 100)}%` }]} />
                    </View>
                )}
            </View>

            {error && <ErrorOverlay msg={error} onRetry={retry} />}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { width: '100%', height: '100%', flex: 1 },
    aspectButton: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(42,42,53,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    fsButton: { position: 'absolute', top: 12, right: 78, backgroundColor: 'rgba(42,42,53,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    smallText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    controlBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(0,0,0,0.5)' },
    playBtn: { paddingHorizontal: 10 },
    playIcon: { color: '#fff', fontSize: 22 },
    seekTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginLeft: 12, justifyContent: 'center' },
    seekFill: { height: 6, backgroundColor: '#6c5ce7', borderRadius: 3 },
    errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 30 },
    errorIcon: { fontSize: 40, marginBottom: 10 },
    errorText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#6c5ce7', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
});
