open-ALERT base station: first set-up
=====================================

This small partition (its label is CIDATA) holds the first set-up of the
base station on this disk. It is read by the base station when it starts for
the first time, the way a Raspberry Pi reads the settings file on its boot
partition. You can open it on any computer: Windows, macOS or Linux.

The files
---------
  user-data   What to set up: the computer's name, an administrator account
              and its SSH key, the time zone, and (if your network needs
              them) a web proxy, a certificate authority, time servers and a
              fixed address. Everything in it is switched off until you
              switch it on; the file itself says how.
  meta-data   One line. Change it only to have user-data read a second time.
  README.txt  This file.

What to do
----------
1. Open user-data in a plain-text editor (Notepad, TextEdit in plain-text
   mode, nano). Not a word processor.
2. Switch on the parts you need. At the least: part 2, with your own SSH
   public key, or nobody will be able to log in.
3. Save it under the same name, "user-data", with nothing added to the name
   (not "user-data.txt"). Eject the disk, put it in the base station, and
   switch the base station on.

What to know
------------
- There is no default password, and no account at all until user-data names
  one. Out of the box the base station starts, receives and shows its
  dashboard, but nobody can log in to it.
- The first start takes a few minutes longer than later ones: the disk's
  main partition is grown to fill the disk, and this computer's own SSH keys
  are made.
- The file is not removed after it has been read, and anybody who holds the
  disk can read it and change it. Put no password and no private key in it.
  A person with the disk in their hands can also add an account this way;
  the last lines of user-data show how to switch that off once the base
  station is set up.
- If the base station does not do what the file says, the file probably has a
  slip in its spacing. Log in and look at:  sudo cloud-init status --long
  If you cannot log in, put the disk back in your own computer, correct
  user-data, change the name in meta-data, and try again.
- After the first set-up: the Flood-Net token, the base station's name and
  where it is are set with the command "rpi-alert setup", or on the dashboard.

More: https://github.com/cdomotor-g/open-ALERT/tree/main/firmware
