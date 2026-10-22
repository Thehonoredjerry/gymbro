{
  lib,
  buildNpmPackage,
  nodejs_22,
  makeWrapper,
  importNpmLock,
  version,
}:

buildNpmPackage rec {
  pname = "gymbro-api";
  inherit version;

  src = ./../../api;

  nodejs = nodejs_22;

  npmDeps = importNpmLock { npmRoot = src; };
  npmConfigHook = importNpmLock.npmConfigHook;

  dontNpmBuild = true;

  nativeBuildInputs = [ makeWrapper ];

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/gymbro-api
    cp -r node_modules $out/lib/gymbro-api/
    # Every top-level module server.js imports: server.js, password.js, passkeys-store.js,
    # rate-limit.js, media.js, device-link.js, push-messages.js, verify-error.js. Copy the
    # glob rather than an explicit list — a hand-kept list silently ships an incomplete tree
    # and the failure only shows up as ERR_MODULE_NOT_FOUND in the systemd journal.
    cp ./*.js $out/lib/gymbro-api/

    mkdir -p $out/bin
    makeWrapper ${nodejs_22}/bin/node $out/bin/gymbro-api \
      --add-flags "$out/lib/gymbro-api/server.js" \
      --set NODE_ENV production
    runHook postInstall
  '';

  meta = with lib; {
    description = "GymBro API — passkey auth + per-user workout data (Node.js)";
    homepage = "https://github.com/Thehonoredjerry/gymbro";
    license = licenses.agpl3Plus;
    platforms = nodejs.meta.platforms;
  };
}
