{
  lib,
  buildNpmPackage,
  nodejs_22,
  importNpmLock,
  version,
}:

buildNpmPackage rec {
  pname = "gymbro-frontend";
  inherit version;

  # The build reads ../catalogue, so it needs the repo root — same layout the Dockerfile uses.
  src = ./../..;
  npmRoot = "frontend";

  nodejs = nodejs_22;

  npmDeps = importNpmLock { npmRoot = src + "/frontend"; };
  npmConfigHook = importNpmLock.npmConfigHook;

  npmBuildScript = "build";

  npmFlags = [ "--ignore-scripts" ];

  buildPhase = ''
    runHook preBuild
    cd frontend
    export NODE_ENV=production
    export PATH="$PWD/node_modules/.bin:$PATH"
    npm run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/gymbro
    cp -r dist/* $out/share/gymbro/
    # The exercise stills and animations come from the source tree (catalogue/media, 180 px,
    # licensed from Gym visual for openGym only: see catalogue/media/NOTICE.md). The same script
    # the demo and Android builds use puts them at exercise-media/ next to the app, which is
    # where the app asks for them. Nothing is downloaded, at build time or at runtime.
    env -u APP_MEDIA_DIR node ../scripts/catalogue/stage-media.mjs $out/share/gymbro
    runHook postInstall
  '';

  meta = with lib; {
    description = "GymBro frontend — self-hosted gym & body-weight tracker PWA";
    homepage = "https://github.com/Thehonoredjerry/gymbro";
    license = licenses.agpl3Plus;
    platforms = nodejs.meta.platforms;
  };
}
