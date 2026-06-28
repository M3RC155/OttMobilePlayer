import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDb = async () => {
    console.log('[DB] initDb called');
    if (db) {
        console.log('[DB] initDb: DB already initialized');
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
    
    // Add error column if it doesn't exist (for existing DBs)
    try {
        await db.execAsync("ALTER TABLE Playlists ADD COLUMN error TEXT;");
    } catch (e) {
        // Column probably already exists, ignore
    }
    console.log('[DB] initDb: Tables created successfully');
    return db;
};

export const getDb = () => db;

export const addPlaylistToDb = async (name: string, url: string, epgUrl: string = '') => {
    console.log(`[DB] addPlaylistToDb called with name=${name}, url=${url}`);
    const database = await initDb();
    const result = await database.runAsync(
        'INSERT INTO Playlists (name, url, epgUrl, isParsed) VALUES (?, ?, ?, 0)',
        [name, url, epgUrl]
    );
    console.log(`[DB] addPlaylistToDb: Inserted with ID=${result.lastInsertRowId}`);
    return result.lastInsertRowId;
};

export const markPlaylistParsed = async (id: number) => {
    console.log(`[DB] markPlaylistParsed called for ID=${id}`);
    const database = await initDb();
    await database.runAsync('UPDATE Playlists SET isParsed = 1, error = NULL WHERE id = ?', [id]);
};

export const setPlaylistError = async (id: number, errorMsg: string) => {
    console.log(`[DB] setPlaylistError called for ID=${id}: ${errorMsg}`);
    const database = await initDb();
    await database.runAsync('UPDATE Playlists SET error = ? WHERE id = ?', [errorMsg, id]);
};

export const getPlaylistsFromDb = async () => {
    console.log('[DB] getPlaylistsFromDb called');
    const database = await initDb();
    const rows = await database.getAllAsync('SELECT * FROM Playlists ORDER BY id DESC');
    console.log(`[DB] getPlaylistsFromDb: Fetched ${rows.length} playlists`);
    return rows.map((r: any) => ({ ...r, isParsed: r.isParsed === 1 }));
};

export const getChannelsFromDb = async (playlistId: number, page: number = 1, pageSize: number = 50) => {
    console.log(`[DB] getChannelsFromDb called for playlistId=${playlistId}, page=${page}`);
    const database = await initDb();
    const offset = (page - 1) * pageSize;
    const rows = await database.getAllAsync(
        'SELECT * FROM Channels WHERE playlistId = ? ORDER BY id ASC LIMIT ? OFFSET ?',
        [playlistId, pageSize, offset]
    );
    console.log(`[DB] getChannelsFromDb: Fetched ${rows.length} channels`);
    return rows;
};

export const getEpgForChannel = async (playlistId: number, tvgId: string) => {
    console.log(`[DB] getEpgForChannel called for playlistId=${playlistId}, tvgId=${tvgId}`);
    if (!tvgId) return [];
    
    const database = await initDb();
    const rows = await database.getAllAsync(
        'SELECT * FROM Programs WHERE playlistId = ? AND tvgId = ? ORDER BY startTime ASC',
        [playlistId, tvgId]
    );
    console.log(`[DB] getEpgForChannel: Fetched ${rows.length} programs`);
    return rows;
};

export const deletePlaylistFromDb = async (id: number) => {
    console.log(`[DB] deletePlaylistFromDb called for ID=${id}`);
    const database = await initDb();
    await database.withTransactionAsync(async () => {
        await database.runAsync('DELETE FROM Programs WHERE playlistId = ?', [id]);
        await database.runAsync('DELETE FROM Channels WHERE playlistId = ?', [id]);
        await database.runAsync('DELETE FROM Playlists WHERE id = ?', [id]);
    });
};

export const updatePlaylistInDb = async (id: number, name: string, url: string, epgUrl: string = '') => {
    console.log(`[DB] updatePlaylistInDb called for ID=${id}`);
    const database = await initDb();
    // We update the url/name/epgUrl and set isParsed = 0 to trigger a re-parse
    await database.runAsync(
        'UPDATE Playlists SET name = ?, url = ?, epgUrl = ?, isParsed = 0, error = NULL WHERE id = ?',
        [name, url, epgUrl, id]
    );
};
