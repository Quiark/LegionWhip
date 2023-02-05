# Legion Whip

Automatically send your Bridgeworld legion to work. 

# Usage

* You'll need a file with private key to hold the legion and pay for gas. The script reads an encrypted file in 0xFrame (that's a wallet) format
  which may be compatible with other things but idk. You could also just change the code to read raw private key. The encrypted file path is 
  given by `KEYCHAIN_FILE` and password `DECRYPT_PASSWORD`.
* Update `LEGION_ID` in `main.ts` to the ID of your legion
* Get an Alchemy API key for Arbitrum, env variable `ALCHEMY_KEY`
* Get a matrix.org account to receive error notifications, create a private room and change `ROOM_ID`.
* matrix username: `CHAT_USERNAME` env var
* matrix password: `CHAT_PASSWORD` env var


# Deployment

There is an ansible script. Edit `ansible/inventory.tufir.yml` to change the host name of your machine. Edit `ansible/roles/main/tasks/main.yml`
task `legion_whip copy the app` to copy the correct private key file.

It doesn't include installing node-js whose version should be (at least) 18.9. Also need to edit `launcher.js` 
