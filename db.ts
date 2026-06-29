import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDb = async () => {
    if (db) {
        return db;
    }
    db = await SQLite.openDatabaseAsync('app.db');
    
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            epgUrl TEXT,
            isParsed INTEGER DEFAULT 0,
            error TEXT
        );
        
        CREATE TABLE IF NOT EXISTS Channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlistId INTEGER NOT NULL,
            name TEXT NOT NULL,
            streamUrl TEXT NOT NULL,
            logoUrl TEXT,
            tvgName TEXT,
            tvgId TEXT,
            FOREIGN KEY(playlistId) REFERENCES Playlists(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS Programs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlistId INTEGER NOT NULL,
            tvgId TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            startTime TEXT,
            endTime TEXT,
            FOREIGN KEY(playlistId) REFERENCES Playlists(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_channels_playlist ON Channels(playlistId);
        CREATE INDEX IF NOT EXISTS idx_programs_lookup ON Programs(playlistId, tvgId);
    `);
    
    try {
        await db.execAsync("ALTER TABLE Playlists ADD COLUMN error TEXT;");
    } catch (e) {
    }
    return db;
};

export const getDb = () => db;

export const addPlaylistToDb = async (name: string, url: string, epgUrl: string = '') => {
    const database = await initDb();
    const result = await database.runAsync(
        'INSERT INTO Playlists (name, url, epgUrl, isParsed) VALUES (?, ?, ?, 0)',
        [name, url, epgUrl]
    );
    return result.lastInsertRowId;
};

export const markPlaylistParsed = async (id: number) => {
    const database = await initDb();
    await database.runAsync('UPDATE Playlists SET isParsed = 1, error = NULL WHERE id = ?', [id]);
};

export const setPlaylistError = async (id: number, errorMsg: string) => {
    const database = await initDb();
    await database.runAsync('UPDATE Playlists SET error = ? WHERE id = ?', [errorMsg, id]);
};

export const getPlaylistsFromDb = async () => {
    const database = await initDb();
    const rows = await database.getAllAsync('SELECT * FROM Playlists ORDER BY id DESC');
    return rows.map((r: any) => ({ ...r, isParsed: r.isParsed === 1 }));
};

export const getChannelsFromDb = async (playlistId: number, page: number = 1, pageSize: number = 50) => {
    const database = await initDb();
    const offset = (page - 1) * pageSize;
    const rows = await database.getAllAsync(
        'SELECT * FROM Channels WHERE playlistId = ? ORDER BY id ASC LIMIT ? OFFSET ?',
        [playlistId, pageSize, offset]
    );
    return rows;
};

export const getEpgForChannel = async (playlistId: number, tvgId: string) => {
    if (!tvgId) return [];
    
    const database = await initDb();
    const rows = await database.getAllAsync(
        'SELECT * FROM Programs WHERE playlistId = ? AND tvgId = ? ORDER BY startTime ASC',
        [playlistId, tvgId]
    );
    return rows;
};

export const deletePlaylistFromDb = async (id: number) => {
    const database = await initDb();
    await database.withTransactionAsync(async () => {
        await database.runAsync('DELETE FROM Programs WHERE playlistId = ?', [id]);
        await database.runAsync('DELETE FROM Channels WHERE playlistId = ?', [id]);
        await database.runAsync('DELETE FROM Playlists WHERE id = ?', [id]);
    });
};

export const updatePlaylistInDb = async (id: number, name: string, url: string, epgUrl: string = '') => {
    const database = await initDb();
    await database.runAsync(
        'UPDATE Playlists SET name = ?, url = ?, epgUrl = ?, isParsed = 0, error = NULL WHERE id = ?',
        [name, url, epgUrl, id]
    );
};
