const songForm = document.getElementById("songSearchForm");
const songInput = document.getElementById("songSearchInput");
const songResults = document.getElementById("songResults");
const songStatus = document.getElementById("songSearchStatus");

const songAudio = document.getElementById("songAudio");
const playerPlaceholder = document.getElementById("playerPlaceholder");
const activePlayer = document.getElementById("activePlayer");

const playerArtwork = document.getElementById("playerArtwork");
const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");
const playerAlbum = document.getElementById("playerAlbum");

const playPauseButton = document.getElementById("playPauseButton");
const previousSong = document.getElementById("previousSong");
const nextSong = document.getElementById("nextSong");

const songProgress = document.getElementById("songProgress");
const currentTimeElement = document.getElementById("currentTime");
const totalTimeElement = document.getElementById("totalTime");

let songs = [];
let currentSongIndex = -1;
let searchTimer = null;

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function setSongStatus(message) {
  songStatus.textContent = message;
}

function getArtwork(url, size = 600) {
  if (!url) {
    return "";
  }

  return url
    .replace("100x100bb", `${size}x${size}bb`)
    .replace("100x100", `${size}x${size}`);
}

function renderSongs() {
  if (!songs.length) {
    songResults.innerHTML = `
      <div class="song-search-status">
        No playable preview found.
      </div>
    `;

    return;
  }

  songResults.innerHTML = songs.map((song, index) => {
    const artwork = getArtwork(
      song.artworkUrl100,
      200
    );

    const title = escapeHTML(song.trackName);
    const artist = escapeHTML(song.artistName);

    const duration = formatTime(
      song.trackTimeMillis / 1000
    );

    return `
      <button
        class="song-result ${
          index === currentSongIndex
            ? "selected"
            : ""
        }"
        data-song-index="${index}"
        type="button"
      >
        <img
          src="${artwork}"
          alt="${title}"
          loading="lazy"
        >

        <span class="song-result-info">
          <span class="song-result-title">
            ${title}
          </span>

          <span class="song-result-artist">
            ${artist}
          </span>
        </span>

        <span class="song-result-duration">
          ${duration}
        </span>
      </button>
    `;
  }).join("");

  document.querySelectorAll(
    "[data-song-index]"
  ).forEach((button) => {
    button.addEventListener("click", () => {
      selectSong(
        Number(button.dataset.songIndex)
      );
    });
  });
}

async function searchSongs(keyword) {
  const query = keyword.trim();

  if (!query) {
    setSongStatus(
      "Search for your favorite song."
    );

    songResults.innerHTML = "";
    return;
  }

  setSongStatus(
    "Searching music database..."
  );

  songResults.innerHTML = "";

  try {
    const apiUrl =
      "https://itunes.apple.com/search?" +
      new URLSearchParams({
        term: query,
        media: "music",
        entity: "song",
        limit: "15"
      });

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = await response.json();

    songs = (data.results || []).filter((song) => {
      return song.previewUrl && song.trackName;
    });

    currentSongIndex = -1;

    if (!songs.length) {
      setSongStatus(
        "No playable preview found."
      );

      songResults.innerHTML = `
        <div class="song-search-status">
          Preview unavailable for this search.
        </div>
      `;

      return;
    }

    setSongStatus(
      `${songs.length} preview song found.`
    );

    renderSongs();

  } catch (error) {
    console.error(error);

    setSongStatus("Search failed.");

    songResults.innerHTML = `
      <div class="song-search-status">
        Connection problem. Please try again.
      </div>
    `;
  }
}

function selectSong(index) {
  const song = songs[index];

  if (!song || !song.previewUrl) {
    setSongStatus(
      "This song has no available preview."
    );

    return;
  }

  currentSongIndex = index;

  const artwork = getArtwork(
    song.artworkUrl100,
    600
  );

  const previewUrl =
    song.previewUrl.replace(
      /^http:/,
      "https:"
    );

  /*
    FIX:
    Placeholder disembunyikan paksa
    sebelum player lagu ditampilkan.
  */
  playerPlaceholder.hidden = true;
  playerPlaceholder.style.display = "none";

  activePlayer.hidden = false;
  activePlayer.style.display = "block";

  playerArtwork.src = artwork;
  playerArtwork.alt =
    `${song.trackName} artwork`;

  playerTitle.textContent = song.trackName;
  playerArtist.textContent = song.artistName;
  playerAlbum.textContent =
    song.collectionName || "Unknown album";

  songAudio.pause();
  songAudio.currentTime = 0;
  songAudio.src = previewUrl;
  songAudio.load();

  playPauseButton.textContent = "▶";
  songProgress.value = 0;
  currentTimeElement.textContent = "00:00";
  totalTimeElement.textContent = "00:00";

  renderSongs();

  songAudio.play()
    .then(() => {
      playPauseButton.textContent = "Ⅱ";
    })
    .catch(() => {
      playPauseButton.textContent = "▶";
      setSongStatus(
        "Press play to start the preview."
      );
    });
}

function togglePlay() {
  if (!songAudio.src) {
    setSongStatus("Select a song first.");
    return;
  }

  if (songAudio.paused) {
    songAudio.play()
      .then(() => {
        playPauseButton.textContent = "Ⅱ";
      })
      .catch(() => {
        setSongStatus(
          "Preview could not be played."
        );
      });
  } else {
    songAudio.pause();
    playPauseButton.textContent = "▶";
  }
}

function selectPreviousSong() {
  if (!songs.length) {
    return;
  }

  const nextIndex =
    currentSongIndex <= 0
      ? songs.length - 1
      : currentSongIndex - 1;

  selectSong(nextIndex);
}

function selectNextSong() {
  if (!songs.length) {
    return;
  }

  const nextIndex =
    currentSongIndex >= songs.length - 1
      ? 0
      : currentSongIndex + 1;

  selectSong(nextIndex);
}

songForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchSongs(songInput.value);
});

songInput.addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    if (songInput.value.trim().length >= 2) {
      searchSongs(songInput.value);
    }
  }, 600);
});

playPauseButton.addEventListener(
  "click",
  togglePlay
);

previousSong.addEventListener(
  "click",
  selectPreviousSong
);

nextSong.addEventListener(
  "click",
  selectNextSong
);

songAudio.addEventListener(
  "loadedmetadata",
  () => {
    totalTimeElement.textContent =
      formatTime(songAudio.duration);
  }
);

songAudio.addEventListener(
  "timeupdate",
  () => {
    if (!songAudio.duration) {
      return;
    }

    const percentage =
      songAudio.currentTime /
      songAudio.duration *
      100;

    songProgress.value = percentage;

    currentTimeElement.textContent =
      formatTime(songAudio.currentTime);
  }
);

songAudio.addEventListener(
  "ended",
  () => {
    playPauseButton.textContent = "▶";

    if (songs.length > 1) {
      selectNextSong();
    }
  }
);

songProgress.addEventListener(
  "input",
  () => {
    if (!songAudio.duration) {
      return;
    }

    songAudio.currentTime =
      Number(songProgress.value) /
      100 *
      songAudio.duration;
  }
);

songAudio.addEventListener(
  "error",
  () => {
    playPauseButton.textContent = "▶";
    setSongStatus(
      "Audio preview is unavailable."
    );
  }
);
