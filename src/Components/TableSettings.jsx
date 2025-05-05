import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { QRCodeSVG } from 'qrcode.react';
import { FaDownload, FaEdit, FaPlus, FaTrash } from 'react-icons/fa';

// Rest of the component code stays the same... 