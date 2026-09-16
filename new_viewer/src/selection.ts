import "./style.css";

async function bootstrap() {
  const sceneModules = import.meta.glob("/public/assets/Scenes/*/scene.json");
  const folders = Object.keys(sceneModules).map((path) => {
    const parts = path.split("/");
    return parts[parts.length - 2];
  });

  const scenes = await Promise.all(
    folders.map(async (folder) => {
      try {
        const response = await fetch(`assets/Scenes/${folder}/scene.json`);
        if (response.ok) {
          const data = await response.json();
          return { folder, name: data.name || folder };
        }
      } catch (e) {
        console.warn("Failed to load scene data for", folder);
      }
      return { folder, name: folder };
    }),
  );

  const buttonContainer = document.getElementById("scene-buttons");
  if (!buttonContainer) {
    console.error("Scene buttons container not found");
    return;
  }

  scenes.forEach((scene) => {
    const btn = document.createElement("button");
    btn.className = "scene-button";
    btn.onclick = () => {
      window.location.href = `${import.meta.env.BASE_URL}scene.html?scene=${encodeURIComponent(scene.folder)}`;
    };

    const img = document.createElement("img");
    img.className = "scene-image";
    img.src = `assets/Scenes/${scene.folder}/preview.png`;
    img.alt = scene.name;
    img.onerror = () => {
      img.src = ""; // Fallback image
    };

    const label = document.createElement("span");
    label.className = "scene-label";
    label.textContent = scene.name;

    btn.appendChild(img);
    btn.appendChild(label);
    buttonContainer.appendChild(btn);
  });
}

bootstrap().catch((err) => {
  console.error("Error during scene selection bootstrap:", err);
});
