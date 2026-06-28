import { StyleSheet } from 'react-native';

export const colors = {
    background: '#0f0f13',
    card: '#1c1c21',
    input: '#2a2a35',
    primary: '#6c5ce7',
    primaryLight: '#a29bfe',
    text: '#ffffff',
    textMuted: '#888888',
};

export const globalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    containerPadded: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 20,
    },
    card: {
        backgroundColor: colors.card,
        padding: 20,
        borderRadius: 16,
    },
    input: {
        backgroundColor: colors.input,
        color: colors.text,
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: colors.primary,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.card,
    },
    backButton: {
        marginRight: 15,
    },
    backText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    titleText: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
    },
    sectionTitle: {
        fontSize: 22,
        color: colors.text,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 20,
    },
    errorActions: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 10,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    deleteButton: {
        backgroundColor: '#ff7675',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    actionText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: 'bold',
    }
});
