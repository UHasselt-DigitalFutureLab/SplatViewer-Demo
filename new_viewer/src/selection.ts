import "./style.css";
import { SCENES } from "./scenes";

function bootstrap() {
  const buttonContainer = document.getElementById("scene-buttons");
  if (!buttonContainer) {
    console.error("Scene buttons container not found");
    return;
  }

  const baseUrl = import.meta.env.BASE_URL;

  SCENES.forEach((scene) => {
    const btn = document.createElement("button");
    btn.className = "scene-button";
    btn.onclick = () => {
      window.location.href = `${baseUrl}scene.html?scene=${encodeURIComponent(scene.id)}`;
    };

    const img = document.createElement("img");
    img.className = "scene-image";
    img.src = `${baseUrl}Assets/Scenes/${scene.id}/preview.png`;
    img.alt = scene.name;
    img.onerror = () => {
      img.style.display = "none";
    };

    const label = document.createElement("span");
    label.className = "scene-label";
    label.textContent = scene.name;

    btn.appendChild(img);
    btn.appendChild(label);
    buttonContainer.appendChild(btn);
  });
}

bootstrap();
