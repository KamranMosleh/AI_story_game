import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, runTransaction } from 'firebase/firestore';
import { PlusCircle, LogIn, RefreshCw, Send, Sparkles, Copy } from 'lucide-react';

// --- Firebase Configuration ---
// IMPORTANT: Replace this with your actual Firebase config object!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global App ID ---
// For local testing, a default ID is fine.
const appId = 'ai-story-weave-local';

// --- Helper Functions ---
const generateGameId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// --- Global Styles ---
const globalStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(51, 65, 85, 0.5); /* slate-700 with opacity */
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(14, 165, 233, 0.6); /* sky-500 with opacity */
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(14, 165, 233, 0.8); /* sky-500 */
  }
  .font-inter {
    font-family: 'Inter', sans-serif;
  }
  /* Add Inter font to HTML head if not already present */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
`;


// --- Main App Component ---
function App() {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [gameId, setGameId] = useState('');
  const [inputGameId, setInputGameId] = useState('');
  const [gameData, setGameData] = useState(null);
  const [storyInput, setStoryInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  const storyEndRef = useRef(null);
  const AI_TURN_INTERVAL = 2; 

  // --- Firebase Authentication ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Authentication error:", err);
          setError("Authentication failed. Please refresh.");
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Game Listener ---
  useEffect(() => {
    if (!isAuthReady || !gameId || !userId) {
      if (gameData) setGameData(null); 
      return;
    }

    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${gameId}`);
    const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.story) {
            data.story = data.story.map(entry => {
                if (entry.timestamp && typeof entry.timestamp.toDate === 'function') {
                    return { ...entry, timestamp: entry.timestamp.toDate() };
                }
                return entry;
            });
        }
        setGameData(data);
        setError(''); 
      } else {
        setGameData(null);
      }
    }, (err) => {
      console.error("Error listening to game data:", err);
      setError("Error fetching game data. Please try again.");
    });

    return () => unsubscribe();
  }, [isAuthReady, gameId, userId]);

  // Scroll to bottom of story
  useEffect(() => {
    if (storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameData?.story]);


  // --- Game Actions ---
  const handleCreateGame = async () => {
    if (!isAuthReady || !userId) {
      setError("Authentication not ready. Please wait.");
      return;
    }
    setIsLoading(true);
    setError('');
    setNotification('');

    const newGameId = inputGameId.trim().toUpperCase() || generateGameId();
    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${newGameId}`);

    try {
      const gameSnap = await getDoc(gameDocRef);
      if (gameSnap.exists()) {
        setError(`Game ID ${newGameId} already exists. Try joining or use a different ID.`);
        setIsLoading(false);
        return;
      }

      const initialPlayer = { id: userId, name: `Player-${userId.substring(0, 5)}` };
      const initialStoryEntry = {
        type: 'system',
        text: `Game "${newGameId}" created by ${initialPlayer.name}. Waiting for the story to begin...`,
        timestamp: new Date(), 
        authorName: 'System',
      };
      const newGameDataForSetDoc = {
        gameId: newGameId,
        players: [initialPlayer],
        story: [initialStoryEntry],
        currentPlayerIndex: 0,
        playerTurnsSinceAI: 0,
        status: 'waiting', 
        createdAt: serverTimestamp(), 
        hostId: userId,
      };
      await setDoc(gameDocRef, newGameDataForSetDoc);
      
      setGameId(newGameId);
      setNotification(`Game ${newGameId} created! Share the ID with friends.`);
    } catch (err) {
      console.error("Error creating game:", err);
      setError("Failed to create game. Please try again. Details: " + err.message);
    }
    setIsLoading(false);
  };

  const handleJoinGame = async () => {
    if (!isAuthReady || !userId) {
      setError("Authentication not ready. Please wait.");
      return;
    }
    if (!inputGameId.trim()) {
      setError("Please enter a Game ID to join.");
      return;
    }
    setIsLoading(true);
    setError('');
    setNotification('');

    const joinId = inputGameId.trim().toUpperCase();
    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${joinId}`);

    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists()) {
          throw new Error(`Game with ID ${joinId} not found.`);
        }
        const currentGameData = gameDoc.data();
        if (!currentGameData.players.find(p => p.id === userId)) {
          const newPlayer = { id: userId, name: `Player-${userId.substring(0, 5)}` };
          const joinMessage = {
            type: 'system',
            text: `${newPlayer.name} joined the game!`,
            timestamp: serverTimestamp(),
            authorName: 'System',
          };
          
          transaction.update(gameDocRef, {
            players: arrayUnion(newPlayer),
            story: arrayUnion(joinMessage),
          });
        }
      });

      setGameId(joinId);
      setNotification(`Joined game ${joinId}!`);
    } catch (err) {
      console.error("Error joining game:", err);
      setError("Failed to join game. " + err.message);
    }
    setIsLoading(false);
  };
  
  const handleStartGame = async () => {
    if (!gameData || gameData.hostId !== userId) {
      setError("Only the host can start the game.");
      return;
    }
    if (!gameData.players || gameData.players.length === 0) {
      setError("Cannot start game: No players in the game.");
      return;
    }
    setIsLoading(true);
    setError('');
    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${gameId}`);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists()) {
          throw new Error("Game document not found!");
        }
        const currentData = gameDoc.data();
        const firstPlayerName = currentData.players[0].name;
        
        const startMessage = {
          type: 'system',
          text: `The story begins! It's ${firstPlayerName}'s turn.`,
          timestamp: serverTimestamp(),
          authorName: 'System',
        };
        
        transaction.update(gameDocRef, {
          status: 'active',
          story: arrayUnion(startMessage),
          currentPlayerIndex: 0,
          playerTurnsSinceAI: 0,
        });
      });
      setNotification("Game started!");
    } catch (err) {
      console.error("Error starting game:", err);
      setError("Failed to start game. Details: " + err.message);
    }
    setIsLoading(false);
  };

  const handleLeaveGame = async () => {
    if (!gameData || !userId) return;
    setIsLoading(true);
    setError('');
    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${gameId}`);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists()) {
          return;
        }
        const currentData = gameDoc.data();
        const leavingPlayerName = currentData.players.find(p => p.id === userId)?.name || 'A player';
        const currentPlayers = currentData.players.filter(p => p.id !== userId);
        
        const playerLeftMessage = {
          type: 'system',
          text: `${leavingPlayerName} left the game.`,
          timestamp: serverTimestamp(),
          authorName: 'System',
        };
        
        let updateData = {
          players: currentPlayers,
          story: arrayUnion(playerLeftMessage),
        };

        if (currentPlayers.length === 0) {
          updateData.status = 'abandoned';
        } else {
          let newCurrentPlayerIndex = currentData.currentPlayerIndex;
          if (currentData.players[currentData.currentPlayerIndex % currentData.players.length]?.id === userId) {
            newCurrentPlayerIndex = currentData.currentPlayerIndex % currentPlayers.length;
          } else {
            const leavingPlayerIndexInOldArray = currentData.players.findIndex(p => p.id === userId);
            if (leavingPlayerIndexInOldArray !== -1 && leavingPlayerIndexInOldArray < currentData.currentPlayerIndex) {
              newCurrentPlayerIndex = Math.max(0, currentData.currentPlayerIndex - 1);
            }
          }
          updateData.currentPlayerIndex = newCurrentPlayerIndex % (currentPlayers.length || 1);
        }
        transaction.update(gameDocRef, updateData);
      });

      setNotification("You left the game.");
      setGameId('');
      setGameData(null);
      setInputGameId('');
    } catch (err) {
      console.error("Error leaving game:", err);
      setError("Failed to leave game. Details: " + err.message);
    }
    setIsLoading(false);
  };

  const handleSubmitStoryPart = async () => {
    if (!storyInput.trim() || !gameData || gameData.status !== 'active') return;
    if (!gameData.players || gameData.players.length === 0) {
        setError("No players in the game to take a turn.");
        return;
    }
    if (gameData.players[gameData.currentPlayerIndex % gameData.players.length]?.id !== userId) {
      setError("It's not your turn!");
      return;
    }

    setIsLoading(true);
    setError('');
    const gameDocRef = doc(db, `artifacts/${appId}/public/data/ai_story_weave_games/${gameId}`);
    
    try {
      const result = await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameDocRef);
        if (!gameDoc.exists()) {
          throw new Error("Game document not found!");
        }
        const currentData = gameDoc.data();
        const currentPlayer = currentData.players[currentData.currentPlayerIndex % currentData.players.length];

        const newStoryPart = {
          type: 'player',
          authorId: currentPlayer.id,
          authorName: currentPlayer.name,
          text: storyInput.trim(),
          timestamp: serverTimestamp(),
        };

        const nextPlayerIndex = (currentData.currentPlayerIndex + 1) % currentData.players.length;
        const newPlayerTurnsSinceAI = currentData.playerTurnsSinceAI + 1;

        transaction.update(gameDocRef, {
          story: arrayUnion(newStoryPart),
          currentPlayerIndex: nextPlayerIndex,
          playerTurnsSinceAI: newPlayerTurnsSinceAI,
          lastTurnTimestamp: serverTimestamp(),
        });

        return {
          needsAITurn: newPlayerTurnsSinceAI >= AI_TURN_INTERVAL && currentData.players.length > 0,
        };
      });

      setStoryInput('');

      if (result.needsAITurn) {
        await triggerAITurn(gameDocRef);
      }

    } catch (err) {
      console.error("Error submitting story part:", err);
      setError("Failed to submit your part. Please try again. Details: " + err.message);
    }
    setIsLoading(false);
  };

  const triggerAITurn = async (gameDocRef) => {
    setIsLoading(true); 
    setNotification("AI is weaving its magic...");

    try {
      const freshGameSnap = await getDoc(gameDocRef);
      if (!freshGameSnap.exists()) {
          throw new Error("Game data disappeared before AI turn.");
      }
      const freshGameData = freshGameSnap.data();
      
      if (!freshGameData.players || freshGameData.players.length === 0) {
        console.warn("AI turn triggered but no players in game.");
        setIsLoading(false);
        setNotification(''); 
        return;
      }

      const storyHistory = freshGameData.story
        .filter(s => s.type === 'player' || s.type === 'ai') 
        .slice(-10) 
        .map(s => `${s.authorName}: ${s.text}`)
        .join("\n");

      const prompt = `You are a master storyteller contributing to a collaborative story. Continue the following story, adding an interesting plot twist, a new character, or a change in scenery. Keep your contribution to 1-2 short paragraphs. Do not repeat previous plot points unless you are building on them significantly. Be creative and engaging! Story so far:\n${storyHistory}\n\nYour contribution (as "AI Storyteller"):\n`;
      
      // IMPORTANT: Replace with your actual Gemini API Key
      const apiKeyGen = "YOUR_GEMINI_API_KEY"; 
      if (apiKeyGen === "YOUR_GEMINI_API_KEY") {
        throw new Error("Gemini API key is not configured in src/App.js");
      }
      
      let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyGen}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("AI API Error Response:", errorBody);
        throw new Error(`AI API request failed with status ${response.status}`);
      }

      const result = await response.json();
      let aiText = "The AI pondered for a moment, then decided to take the story in a new direction..."; 

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        aiText = result.candidates[0].content.parts[0].text;
      } else {
        console.warn("AI response structure unexpected or content missing:", result);
      }

      const aiStoryPart = {
        type: 'ai',
        authorName: 'AI Storyteller',
        text: aiText.trim(),
        timestamp: serverTimestamp(), 
      };

      await updateDoc(gameDocRef, { 
        story: arrayUnion(aiStoryPart),
        playerTurnsSinceAI: 0, 
        lastTurnTimestamp: serverTimestamp(),
      });
      
      setNotification("AI has added to the story!");
    } catch (err) {
      console.error("Error during AI turn:", err);
      setError("AI failed to contribute. The story continues with players. Details: " + err.message);
    }
    setIsLoading(false);
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      setNotification(`Copied "${text}" to clipboard!`);
    } catch (e) {
      setNotification("Failed to copy to clipboard.");
      console.error("Clipboard copy failed:", e);
    }
    document.body.removeChild(el);
    setTimeout(() => setNotification(''), 2000);
  };


  // --- Render Logic ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-4 font-inter">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-sky-400 animate-spin mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Initializing Story Weave...</h1>
          <p className="text-slate-400 mt-2">Warming up the AI storytellers...</p>
        </div>
      </div>
    );
  }

  // --- Game Setup Screen ---
  if (!gameId || !gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-4 font-inter">
         <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="w-full max-w-md bg-slate-800 shadow-2xl rounded-xl p-6 md:p-8">
          <Sparkles className="w-16 h-16 text-sky-400 mx-auto mb-6 opacity-80" />
          <h1 className="text-4xl font-bold text-center mb-2 text-sky-100">AI Story Weave</h1>
          <p className="text-center text-slate-400 mb-8">Collaborate with friends and AI to craft unique tales.</p>

          {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</p>}
          {notification && <p className="bg-green-500/20 text-green-300 p-3 rounded-md mb-4 text-sm">{notification}</p>}
          
          <div className="mb-6">
            <label htmlFor="gameIdInput" className="block text-sm font-medium text-slate-300 mb-1">Game ID (optional for new game)</label>
            <input
              id="gameIdInput"
              type="text"
              value={inputGameId}
              onChange={(e) => setInputGameId(e.target.value.toUpperCase())}
              placeholder="Enter Game ID or leave blank"
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={handleCreateGame}
              disabled={isLoading}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlusCircle size={20} /> Create Game
            </button>
            <button
              onClick={handleJoinGame}
              disabled={isLoading || !inputGameId.trim()}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn size={20} /> Join Game
            </button>
          </div>
          
          {isLoading && <p className="text-center text-sky-400 animate-pulse">Processing...</p>}

          <div className="mt-6 text-xs text-slate-500 text-center">
            Your User ID: <span className="font-mono">{userId}</span> <br/>
            App ID: <span className="font-mono">{appId}</span>
          </div>
        </div>
         <div className="w-full max-w-md bg-slate-800 shadow-xl rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-sky-200 mb-3">How to Play</h2>
            <ol className="list-decimal list-inside text-slate-300 space-y-1 text-sm">
                <li><strong>Create a Game:</strong> Start a new story. Share the generated Game ID.</li>
                <li><strong>Join a Game:</strong> Enter an existing Game ID to join friends.</li>
                <li><strong>Take Turns:</strong> Add your part to the story when it's your turn.</li>
                <li><strong>AI Interjects:</strong> After every {AI_TURN_INTERVAL} player turns, the AI adds a twist!</li>
                <li><strong>Collaborate:</strong> Work together to build an epic narrative.</li>
            </ol>
        </div>
      </div>
    );
  }

  // --- Game Active Screen ---
  const currentPlayer = gameData.players && gameData.players.length > 0 ? gameData.players[gameData.currentPlayerIndex % gameData.players.length] : null;
  const isMyTurn = currentPlayer?.id === userId && gameData.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col p-2 sm:p-4 font-inter">
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      {/* Header */}
      <header className="mb-4 p-4 bg-slate-800/50 backdrop-blur-md rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-sky-300">AI Story Weave</h1>
            <div className="text-sm text-slate-400 flex items-center gap-2">
              Game ID: <span className="font-mono text-sky-400">{gameId}</span>
              <button onClick={() => copyToClipboard(gameId)} title="Copy Game ID" className="text-slate-500 hover:text-sky-400 transition-colors">
                <Copy size={14} />
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
             <div className="text-xs text-slate-500">
                Your User ID: <span className="font-mono">{userId ? userId : 'N/A'}</span>
             </div>
            <button
              onClick={handleLeaveGame}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Leave Game
            </button>
          </div>
        </div>
        {error && <p className="bg-red-500/20 text-red-300 p-2 rounded-md mt-2 text-xs">{error}</p>}
        {notification && <p className="bg-green-500/20 text-green-300 p-2 rounded-md mt-2 text-xs">{notification}</p>}
      </header>

      {/* Game Area */}
      <div className="flex flex-col lg:flex-row gap-4 flex-grow overflow-hidden">
        {/* Story Display */}
        <div className="lg:w-2/3 bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-md p-4 sm:p-6 flex flex-col overflow-hidden">
          <h2 className="text-xl font-semibold text-sky-200 mb-3 border-b border-slate-700 pb-2">The Story So Far...</h2>
          <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {gameData.story.map((entry, index) => (
              <div key={index} className={`p-3 rounded-lg shadow ${
                entry.type === 'player' ? (entry.authorId === userId ? 'bg-sky-700/50 ml-auto max-w-[85%]' : 'bg-slate-700/80 mr-auto max-w-[85%]') :
                entry.type === 'ai' ? 'bg-purple-700/60 my-3 border border-purple-500' :
                'bg-slate-600/50 text-center text-xs italic py-1'
              }`}>
                <p className={`font-semibold text-sm mb-1 ${
                  entry.type === 'player' ? (entry.authorId === userId ? 'text-sky-200' : 'text-teal-200') :
                  entry.type === 'ai' ? 'text-purple-200 flex items-center gap-1' : 'text-slate-400'
                }`}>
                  {entry.type === 'ai' && <Sparkles size={14} className="opacity-80" />}
                  {entry.authorName}
                  {entry.timestamp &&  
                    <span className="text-slate-500 ml-1 text-xs"> ({new Date(entry.timestamp).toLocaleTimeString()})</span>}
                </p>
                <p className="text-slate-100 whitespace-pre-wrap text-sm leading-relaxed">{entry.text}</p>
              </div>
            ))}
            <div ref={storyEndRef} />
          </div>
        </div>

        {/* Player Info & Input */}
        <div className="lg:w-1/3 bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-md p-4 sm:p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-sky-200 mb-3 border-b border-slate-700 pb-2">Players</h2>
          <ul className="space-y-1 text-sm mb-4">
            {gameData.players.map((p, index) => (
              <li key={p.id} className={`p-2 rounded ${
                gameData.status === 'active' && gameData.players.length > 0 && index === (gameData.currentPlayerIndex % gameData.players.length) ? 'bg-sky-600/50 ring-1 ring-sky-400' : 'bg-slate-700/50'
              } ${p.id === userId ? 'font-bold text-sky-300' : 'text-slate-300'}`}>
                {p.name} {p.id === userId && "(You)"}
                {gameData.status === 'active' && gameData.players.length > 0 && index === (gameData.currentPlayerIndex % gameData.players.length) && <span className="text-xs italic ml-2 text-sky-300">(Current Turn)</span>}
              </li>
            ))}
          </ul>
          {gameData.players.length === 0 && <p className="text-slate-400 text-sm">No players in the game yet.</p>}


          {gameData.status === 'waiting' && gameData.hostId === userId && gameData.players.length > 0 && (
            <button
              onClick={handleStartGame}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors mb-4 disabled:opacity-50"
            >
              Start Game
            </button>
          )}
          {gameData.status === 'waiting' && gameData.hostId !== userId && (
             <p className="text-center text-slate-400 p-3 bg-slate-700/50 rounded-md mb-4">Waiting for the host ({(gameData.players.find(p=>p.id === gameData.hostId)?.name || 'Host')}) to start the game...</p>
          )}


          {gameData.status === 'active' && (
            <>
              <h3 className="text-lg font-semibold text-sky-300 mb-2">
                {isMyTurn ? "Your Turn!" : (currentPlayer ? `${currentPlayer.name}'s Turn` : "Waiting for player...")}
              </h3>
              <textarea
                value={storyInput}
                onChange={(e) => setStoryInput(e.target.value)}
                placeholder={isMyTurn ? "Continue the story..." : "Wait for your turn..."}
                rows={5}
                disabled={!isMyTurn || isLoading}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors mb-3 text-sm disabled:opacity-60"
              />
              <button
                onClick={handleSubmitStoryPart}
                disabled={!isMyTurn || isLoading || !storyInput.trim()}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading && isMyTurn ? <RefreshCw className="animate-spin" size={20}/> : <Send size={20} />}
                Submit Contribution
              </button>
              {isLoading && <p className="text-center text-sky-400 animate-pulse mt-2">Processing...</p>}
              <p className="text-xs text-slate-500 mt-3">
                AI contributes after {AI_TURN_INTERVAL - (gameData.playerTurnsSinceAI % AI_TURN_INTERVAL) } more player turn(s).
              </p>
            </>
          )}
           {gameData.status !== 'active' && gameData.status !== 'waiting' && (
             <p className="text-center text-orange-400 p-3 bg-orange-700/30 rounded-md">Game is currently {gameData.status}.</p>
           )}
        </div>
      </div>
    </div>
  );
}

export default App;

