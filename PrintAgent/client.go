package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// BusinessInfo holds info from the SSE connected event
type BusinessInfo struct {
	BusinessID   string `json:"businessId"`
	BusinessName string `json:"businessName"`
	Address      string `json:"address"`
	Phone        string `json:"phone"`
	NIT          string `json:"nit"`
	Slug         string `json:"slug"`
	PrintMode    string `json:"printMode"` // "comanda", "recibo", or "both"
}

// SSEClient manages the connection to the backend SSE stream
type SSEClient struct {
	config       *Config
	business     *BusinessInfo
	onOrder      func(order map[string]interface{})
	onReceipt    func(order map[string]interface{})
	onConnect    func(info *BusinessInfo)
	onDisconnect func()
	connected    bool
	mu           sync.RWMutex
	stopCh       chan struct{}
}

// NewSSEClient creates a new SSE client
func NewSSEClient(cfg *Config) *SSEClient {
	return &SSEClient{
		config: cfg,
		stopCh: make(chan struct{}),
	}
}

// IsConnected returns the connection status
func (c *SSEClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// GetBusiness returns the connected business info
func (c *SSEClient) GetBusiness() *BusinessInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.business
}

// Start begins the SSE connection with automatic reconnect
func (c *SSEClient) Start() {
	go c.connectLoop()
}

// Stop terminates the SSE connection
func (c *SSEClient) Stop() {
	close(c.stopCh)
}

func (c *SSEClient) connectLoop() {
	backoff := time.Second

	for {
		select {
		case <-c.stopCh:
			return
		default:
		}

		err := c.connect()
		if err != nil {
			log.Printf("[SSE] Connection error: %v", err)
		}

		c.mu.Lock()
		c.connected = false
		c.mu.Unlock()

		if c.onDisconnect != nil {
			c.onDisconnect()
		}

		// Exponential backoff: 1s, 2s, 4s, 8s, max 30s
		select {
		case <-c.stopCh:
			return
		case <-time.After(backoff):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

func (c *SSEClient) connect() error {
	url := fmt.Sprintf("%s/api/print-agent/stream?key=%s", c.config.APIUrl, c.config.PrintKey)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{
		Timeout: 0, // No timeout for SSE
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("connecting: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return fmt.Errorf("invalid API key (401)")
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	log.Println("[SSE] Connected to server")

	scanner := bufio.NewScanner(resp.Body)
	// Increase buffer for large order payloads
	scanner.Buffer(make([]byte, 0, 64*1024), 256*1024)

	var eventType string
	var dataLines []string

	for scanner.Scan() {
		select {
		case <-c.stopCh:
			return nil
		default:
		}

		line := scanner.Text()

		// Empty line = dispatch event
		if line == "" {
			if eventType != "" && len(dataLines) > 0 {
				data := strings.Join(dataLines, "\n")
				c.handleEvent(eventType, data)
			}
			eventType = ""
			dataLines = nil
			continue
		}

		// Comment (keepalive)
		if strings.HasPrefix(line, ":") {
			continue
		}

		if strings.HasPrefix(line, "event: ") {
			eventType = strings.TrimPrefix(line, "event: ")
		} else if strings.HasPrefix(line, "data: ") {
			dataLines = append(dataLines, strings.TrimPrefix(line, "data: "))
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("reading stream: %w", err)
	}

	return fmt.Errorf("stream ended")
}

func (c *SSEClient) handleEvent(eventType, data string) {
	switch eventType {
	case "connected":
		var info BusinessInfo
		if err := json.Unmarshal([]byte(data), &info); err != nil {
			log.Printf("[SSE] Error parsing connected event: %v", err)
			return
		}
		c.mu.Lock()
		c.business = &info
		c.connected = true
		c.mu.Unlock()

		log.Printf("[SSE] Connected to business: %s (%s)", info.BusinessName, info.Slug)
		if c.onConnect != nil {
			c.onConnect(&info)
		}

	case "order_created":
		var order map[string]interface{}
		if err := json.Unmarshal([]byte(data), &order); err != nil {
			log.Printf("[SSE] Error parsing order: %v", err)
			return
		}

		orderNum, _ := order["orderNumber"].(string)
		customerName, _ := order["customerName"].(string)
		log.Printf("[SSE] New order (comanda): #%s - %s", orderNum, customerName)

		if c.onOrder != nil {
			c.onOrder(order)
		}

	case "print_receipt":
		var order map[string]interface{}
		if err := json.Unmarshal([]byte(data), &order); err != nil {
			log.Printf("[SSE] Error parsing receipt order: %v", err)
			return
		}

		orderNum, _ := order["orderNumber"].(string)
		log.Printf("[SSE] Print receipt: #%s", orderNum)

		if c.onReceipt != nil {
			c.onReceipt(order)
		}

	default:
		log.Printf("[SSE] Unknown event: %s", eventType)
	}
}
