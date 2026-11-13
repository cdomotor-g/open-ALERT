// open-ALERT — photographs the hardware review may show, and the licence each is shown under.
//
// Only pictures under a licence that allows reuse (CC BY, CC BY-SA) are listed;
// each is a resized copy of the original, kept in site/img/hw/. The page must
// show the author, the licence and a link to the source beside each picture.
// A computer with no entry here has no photograph the site may lawfully use:
// the page draws its own picture for it.
//
// Each record: file (under site/img/hw/), alt (what the picture shows, in
// plain words), subject (what it is a picture of), author, licence (short
// name), licenceUrl, source (the picture's own page) and changes (what was done
// to the original). `credit` is the credit line the author asks for, where the
// picture's page gives one: the page shows it in place of the author's name.
//
// Each licence and author was read on the picture's own page on 13 November
// 2026 (the five Wikimedia Commons file pages, and the two BeagleBoard.org
// documentation pages, whose footer puts the whole work under CC BY-SA 4.0).
// A picture whose licence cannot be confirmed does not belong here.

(function () {
  const BEAGLE_LICENCE = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const images = {
    'rpi-4': {
      file: 'rpi-4.jpg',
      alt: 'The top of a Raspberry Pi 4 Model B circuit board, with its main chip, two USB 3 sockets, the network socket and two small HDMI sockets.',
      subject: 'Raspberry Pi 4 Model B',
      author: 'Laserlicht',
      credit: 'Laserlicht / Wikimedia Commons',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_4_Model_B_-_Top.jpg',
      changes: 'resized',
    },
    'rpi-5': {
      file: 'rpi-5.jpg',
      alt: 'The top of a Raspberry Pi 5 circuit board on a white background, with its main chip, two USB 3 sockets and the network socket.',
      subject: 'Raspberry Pi 5',
      author: 'SimonWaldherr',
      licence: 'CC BY 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_5.jpg',
      changes: 'resized',
    },
    'rpi-cm': {
      file: 'rpi-cm.jpg',
      alt: 'A Raspberry Pi Compute Module, a small computer on a plug-in card, sitting in its larger carrier circuit board with rows of pins along the bottom. This is the early Compute Module 3 on its first IO board; the Compute Module 5 on its newer IO board has the same arrangement.',
      subject: 'Raspberry Pi Compute Module 3 on the Compute Module IO Board V3',
      author: 'the Raspberry Pi Foundation',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_Compute_Module_IO_Board_V3_with_Compute_Module_3.jpg',
      changes: 'resized',
    },
    'beagleplay': {
      file: 'beagleplay.jpg',
      alt: 'The top of a BeaglePlay board, dark with white printing, with a square mikroBUS socket in the middle, a coin-cell holder at the lower left and a network socket and USB sockets along the bottom edge.',
      subject: 'BeagleBoard.org BeaglePlay',
      author: 'BeagleBoard.org Foundation',
      licence: 'CC BY-SA 4.0',
      licenceUrl: BEAGLE_LICENCE,
      source: 'https://docs.beagleboard.org/boards/beagleplay/index.html',
      changes: 'resized',
    },
    'beagley-ai': {
      file: 'beagley-ai.jpg',
      alt: 'Both sides of a BeagleY-AI board side by side: on the left the top, with two USB 3 sockets and the network socket at the top and the main chip in the middle; on the right the underside, with the microSD card slot at the bottom.',
      subject: 'BeagleBoard.org BeagleY-AI',
      author: 'BeagleBoard.org Foundation',
      licence: 'CC BY-SA 4.0',
      licenceUrl: BEAGLE_LICENCE,
      source: 'https://docs.beagleboard.org/boards/beagley/ai/01-introduction.html',
      changes: 'resized',
    },
    'lenovo-tiny': {
      file: 'lenovo-tiny.jpg',
      alt: 'A black Lenovo ThinkCentre Tiny small desktop computer lying flat, seen from the back corner, showing its power socket, display sockets, USB sockets and network socket. It is the M715q, an AMD model in the same case as the Intel M920q.',
      subject: 'Lenovo ThinkCentre M715q Tiny (same case family as the M920q Tiny)',
      author: 'Alexey Vazhnov',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:P5300597_Lenovo_ThinkCentre_m715q.webp',
      changes: 'resized',
    },
    'dell-micro': {
      file: 'dell-micro.jpg',
      alt: 'A black Dell OptiPlex Micro small desktop computer lying flat, seen from the front corner, with its power button, two audio sockets, two USB sockets and the Dell logo on the front.',
      subject: 'Dell OptiPlex 3060 Micro',
      author: 'Cjp24',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Dell_OptiPlex_3060_Micro_(1).jpg',
      changes: 'resized',
    },
  };
  if (typeof module === 'object' && module.exports) module.exports = images;
  else globalThis.OA_REVIEW_IMAGES = images;
})();
