#!/usr/bin/env node
const axios = require('axios');
// const ora = require('ora');
const si = require('systeminformation');
const yargs = require('yargs/yargs')(process.argv.slice(2));
const { hideBin } = require('yargs/helpers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let inquirer;

const apiUrl = process.env.API_URL;

// Setup yargs to define command-line arguments and handle interactive prompts
const argv = yargs
  .usage("Usage: -c <command>")
  .option("c", { alias: "command", describe: "Command to execute", type: "string", demandOption: true })
  .option("username", { alias: "u", describe: "Your username", type: "string" })
  .option("password", { alias: "p", describe: "Your password", type: "string" })
  .option("ethereumAddress", { alias: "e", describe: "Ethereum address", type: "string" })
  .option("email", { alias: "email", describe: "Your email address", type: "string" })
  .option("token", { alias: "t", describe: "Your auth token", type: "string" })
  .option("docId", { alias: "d", describe: "Document ID for job details", type: "string" })
  .option("edit-script", { describe: "Edit the training script before execution", type: "boolean" })
  .option("run-script", { describe: "Execute the training script", type: "boolean" })
  .option("run-on-runpod", { describe: "Execute the script on RunPod", type: "boolean" })
  .help()
  .alias('help', 'h')
  .argv;

async function getSystemDetails() {
    const cpu = await si.cpu();
    const graphics = await si.graphics();
    const networkInterfaces = await si.networkInterfaces();
    const osInfo = await si.osInfo();
    return {
        cpu: {
            brand: cpu.brand,
            cores: cpu.cores,
            manufacturer: cpu.manufacturer,
            physicalCores: cpu.physicalCores,
            speed: cpu.speed
        },
        graphics: graphics.controllers.map(gpu => ({
            model: gpu.model,
            vram: gpu.vram
        })),
        network: networkInterfaces.map(iface => ({
            iface: iface.ifaceName,
            ip4: iface.ip4,
            mac: iface.mac
        })),
        os: {
            distro: osInfo.distro,
            platform: osInfo.platform,
            release: osInfo.release
        }
    };
}

async function editScript(docId) {
    console.log(`Received docId: ${docId}`); // Check what you receive
    const editor = process.env.EDITOR || 'vim';
    const scriptPath = path.join(__dirname, 'jobs', docId, 'script.py');
    console.log(`Path to script: ${scriptPath}`); // Verify path construction

    exec(`${editor} ${scriptPath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Failed to open editor: ${err}`);
            return;
        }
        console.log('Script editing completed.');
    });
}

const executeScript = async (docId) => {
    const ora = (await import('ora')).default;
    const jobDir = path.join(__dirname, 'jobs', docId);
    const scriptPath = path.join(jobDir, 'script.py');
    const venvPath = path.join(jobDir, 'venv');
    const requirementsPath = path.join(jobDir, 'requirements.txt');

    // Determine commands based on the operating system
    const isWindows = process.platform === "win32";
    const activateScript = isWindows ? "\\Scripts\\activate.bat" : "/bin/activate";
    const pythonExecutable = isWindows ? "\\Scripts\\python.exe" : "/bin/python";

    // Function to execute a command with ora spinner
    const executeCommand = (command, message) => {
        return new Promise((resolve, reject) => {
            const spinner = ora(message).start();
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    spinner.fail(`${message} failed: ${error.message}`);
                    reject(error);
                } else {
                    if (stderr) {
                        spinner.fail(`${message} completed with errors: ${stderr}`);
                        reject(new Error(stderr));
                    } else {
                        spinner.succeed(`${message} completed successfully.`);
                        resolve(stdout);
                    }
                }
            });
        });
    };

    try {
        // Create virtual environment
        await executeCommand(`python -m venv "${venvPath}"`, "Creating virtual environment");

        // Activate virtual environment and install packages
        // await executeCommand(
        //     `${venvPath}${activateScript} && pip install -r "${requirementsPath}"`, 
        //     "Activating virtual environment and installing packages"
        // );
        await executeCommand(
            `${venvPath}${activateScript}`, 
            "Activating virtual environment"
        );
        await executeCommand(
            `pip install -r "${requirementsPath}"`, 
            "Installing packages"
        );

        // Run the Python script
        const resultsDir = path.join(jobDir, 'results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        const output = await executeCommand(
            `${venvPath}${pythonExecutable} "${scriptPath}"`, 
            "Running the Python script"
        );

        fs.writeFileSync(path.join(resultsDir, 'stdout.txt'), output);
        console.log(`Results saved to ${resultsDir}`);
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
};

async function uploadResults(stdout, stderr) {
    console.log('Uploading results...');
    // Implement the logic to upload the results to your backend or blockchain
}

async function executeOnRunPod(scriptPath, trainingDataPath, validationDataPath) {
    console.log('Setting up job on RunPod...');
    // Implement the logic to interact with RunPod's API to setup and trigger the job
}

const handleRegisterMiner = async () => {
    const { ethereumAddress, username, email } = argv;
    try {
        const response = await axios.post(`${apiUrl}/register-miner`, { ethereumAddress, username, email });
        console.log('Registration successful:', response.data);
    } catch (error) {
        console.error('Registration failed:', error.response?.data?.error || 'Server error');
    }
};

const handleLogin = async () => {
    const { username, password } = argv;
    console.log("Username $ password: ", username, password);
    try {
        const response = await axios.post(`${apiUrl}/login`, { username, password });
        
        // Write the token
        fs.writeFileSync(path.join(__dirname, '.token'), response.data.token);

        // Ensure minerId is a string and write it
        if (response.data.minerId) {
            fs.writeFileSync(path.join(__dirname, '.minerId'), response.data.minerId.toString());
        } else {
            console.error('Miner ID is missing in the response.');
        }

        console.log('Login successful. Token and Miner ID received.');
    } catch (error) {
        console.error('Login failed:', error.response?.data?.error || error);
    }
};

  const handleLogout = () => {
    try {
        // Remove the authentication token file
        const tokenPath = path.join(__dirname, '.token');
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
            console.log('Authentication token removed.');
        }

        // Remove the jobs directory and all its contents
        const jobsDir = path.join(__dirname, 'jobs');
        if (fs.existsSync(jobsDir)) {
            fs.rmdirSync(jobsDir, { recursive: true });
            console.log('Job data directory removed.');
        }

        console.log('Logged out successfully.');
    } catch (error) {
        console.error('Logout failed:', error.message);
    }
};

const getToken = () => {
    try {
        return fs.readFileSync(path.join(__dirname, '.token'), 'utf8');
    } catch (error) {
        console.error('Error reading token:', error.message);
        return null;
    }
};

const getMinerId = () => {
    try {
        return fs.readFileSync(path.join(__dirname, '.minerId'), 'utf8');
    } catch (error) {
        console.error('Error reading miner ID:', error.message);
        return null;
    }
};


const handleFetchPendingJobs = async () => {
    const token = getToken();
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }
    try {
        const response = await axios.get(`${apiUrl}/pending-jobs`, { headers: { Authorization: `Bearer ${token}` } });
        console.log('Pending jobs:', response.data);
    } catch (error) {
        console.error('Failed to fetch pending jobs:', error.response?.data?.error || 'Server error');
    }
};

const handleFetchJobDetails = async () => {
    const token = getToken();
    const { docId } = argv;
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }
    try {
        const response = await axios.get(`${apiUrl}/job-details/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
        console.log('Job details:', response.data);
    } catch (error) {
        console.error('Failed to fetch job details:', error.response?.data?.error || 'Server error');
    }
};

const start_training = async () => {
    const token = getToken();
    const minerId = getMinerId();
    const systemDetails = await getSystemDetails();
    const { docId } = argv;
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }

    // Confirmation prompt
    const answers = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmTraining',
        message: 'Starting training will trigger execution of the training job. Do you want to continue?',
        default: false
    }]);

    if (!answers.confirmTraining) {
        console.log('Training start cancelled.');
        return;
    }

    try {
        const response = await axios.post(`${apiUrl}/start-training/${docId}`, {
            systemDetails,
            minerId
        }, {
            headers: { Authorization: `Bearer ${token}`, 'X-Miner-ID': minerId }
        });
        const train_job = response.data;
        console.log('Job details fetched successfully. See details below:');
        // console.log(train_job);

        const jobDir = path.join(__dirname, 'jobs', docId);
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }

        const detailsPath = path.join(jobDir, 'details.txt');
        fs.writeFileSync(detailsPath, JSON.stringify(train_job, null, 2));
        console.log(`Job details saved to: ${detailsPath}`);

        // Download files using the URLs provided
        await downloadFile(train_job.scriptUrl, path.join(jobDir, 'script.py'));
        await downloadFile(train_job.trainingFileUrl, path.join(jobDir, 'trainingData.xlsx'));
        await downloadFile(train_job.validationFileUrl, path.join(jobDir, 'validationData.xlsx'));

        // Generate and save requirements.txt for the Python environment
        const requirements = [
            'torch',
            'transformers',
            'datasets',
            'numpy',
            'pandas',
            'scikit-learn'
        ];
        
        fs.writeFileSync(path.join(jobDir, 'requirements.txt'), requirements.join('\n'));
        console.log('Requirements.txt saved successfully.');

        console.log(`Training job fetched successfully. Check directory: ${jobDir}`);
    } catch (error) {
        console.error('Failed to fetch job details:', error.response?.data?.error || error);
    }
};

const downloadFile = async (fileUrl, outputPath) => {
    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Download failed:', error.message);
    }
};

// Execute command based on user input
(async () => {
    inquirer = (await import('inquirer')).default;
    switch (argv.command) {
        case 'edit-script':
            await editScript(argv.docId);
            break;
        case 'execute':
            await executeScript(argv.docId);
            break;
        case 'run-on-runpod':
            await executeOnRunPod(
                path.join(__dirname, 'jobs', argv.docId, 'script.py'),
                path.join(__dirname, 'jobs', argv.docId, 'trainingData.xlsx'),
                path.join(__dirname, 'jobs', argv.docId, 'validationData.xlsx')
            );
            break;
        case 'login':
            await handleLogin();
            break;
        case 'logout':
            handleLogout();
            break;
        case 'register-miner':
            await handleRegisterMiner();
            break;
        case 'fetch-pending-jobs':
            await handleFetchPendingJobs();
            break;
        case 'fetch-job-details':
            await handleFetchJobDetails();
            break;
        case 'train-jobs':
            await start_training();
            break;
        default:
            console.log('Invalid command');
            break;
    }
})();

